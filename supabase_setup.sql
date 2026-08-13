-- HotUpdater.bundles

CREATE TYPE platforms AS ENUM ('ios', 'android');

CREATE TABLE bundles (
    id uuid PRIMARY KEY,
    platform platforms NOT NULL,
    target_app_version text NOT NULL,
    should_force_update boolean NOT NULL,
    enabled boolean NOT NULL,
    file_url text NOT NULL,
    file_hash text NOT NULL,
    git_commit_hash text,
    message text
);

CREATE INDEX bundles_target_app_version_idx ON bundles(target_app_version);


-- HotUpdater.get_update_info

CREATE OR REPLACE FUNCTION get_update_info (
    app_platform   platforms,
    app_version text,
    bundle_id  uuid
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    file_url      text,
    file_hash     text,
    status        text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH rollback_candidate AS (
        SELECT
            b.id,
            -- If status is 'ROLLBACK', should_force_update is always TRUE
            TRUE AS should_force_update,
            b.file_url,
            b.file_hash,
            'ROLLBACK' AS status
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
        ORDER BY b.id DESC
        LIMIT 1
    ),
    update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.file_url,
            b.file_hash,
            'UPDATE' AS status
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND semver_satisfies(b.target_app_version, app_version)
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT *
        FROM update_candidate

        UNION ALL

        SELECT *
        FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result WHERE final_result.id != bundle_id

    UNION ALL
    /*
      When there are no final results and bundle_id != NIL_UUID,
      add one fallback row.
      This fallback row is also ROLLBACK so shouldForceUpdate = TRUE.
    */
    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,  -- Always TRUE
        NULL          AS file_url,
        NULL          AS file_hash,
        'ROLLBACK'    AS status
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID;

END;
$$;

-- HotUpdater.semver_satisfies

CREATE OR REPLACE FUNCTION semver_satisfies(range_expression TEXT, version TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    version_parts TEXT[];
    version_major INT;
    version_minor INT;
    version_patch INT;
    satisfies BOOLEAN := FALSE;
BEGIN
    -- Split the version into major, minor, and patch
    version_parts := string_to_array(version, '.');
    version_major := version_parts[1]::INT;
    version_minor := version_parts[2]::INT;
    version_patch := version_parts[3]::INT;

    -- Parse range expression and evaluate
    IF range_expression ~ '^\d+\.\d+\.\d+$' THEN
        -- Exact match
        satisfies := (range_expression = version);

    ELSIF range_expression = '*' THEN
        -- Matches any version
        satisfies := TRUE;

    ELSIF range_expression ~ '^\d+\.x\.x$' THEN
        -- Matches major.x.x
        DECLARE
            major_range INT := split_part(range_expression, '.', 1)::INT;
        BEGIN
            satisfies := (version_major = major_range);
        END;

    ELSIF range_expression ~ '^\d+\.\d+\.x$' THEN
        -- Matches major.minor.x
        DECLARE
            major_range INT := split_part(range_expression, '.', 1)::INT;
            minor_range INT := split_part(range_expression, '.', 2)::INT;
        BEGIN
            satisfies := (version_major = major_range AND version_minor = minor_range);
        END;

    ELSIF range_expression ~ '^\d+\.\d+$' THEN
        -- Matches major.minor
        DECLARE
            major_range INT := split_part(range_expression, '.', 1)::INT;
            minor_range INT := split_part(range_expression, '.', 2)::INT;
        BEGIN
            satisfies := (version_major = major_range AND version_minor = minor_range);
        END;

    ELSIF range_expression ~ '^\d+\.\d+\.\d+ - \d+\.\d+\.\d+$' THEN
        -- Matches range e.g., 1.2.3 - 1.2.7
        DECLARE
            lower_bound TEXT := split_part(range_expression, ' - ', 1);
            upper_bound TEXT := split_part(range_expression, ' - ', 2);
        BEGIN
            satisfies := (version >= lower_bound AND version <= upper_bound);
        END;

    ELSIF range_expression ~ '^>=\d+\.\d+\.\d+ <\d+\.\d+\.\d+$' THEN
        -- Matches range with inequalities
        DECLARE
            lower_bound TEXT := regexp_replace(range_expression, '>=([\d\.]+) <.*', '\1');
            upper_bound TEXT := regexp_replace(range_expression, '.*<([\d\.]+)', '\1');
        BEGIN
            satisfies := (version >= lower_bound AND version < upper_bound);
        END;

    ELSIF range_expression ~ '^~\d+\.\d+\.\d+$' THEN
        -- Matches ~1.2.3 (>=1.2.3 <1.3.0)
        DECLARE
            lower_bound TEXT := regexp_replace(range_expression, '~', '');
            upper_bound_major INT := split_part(lower_bound, '.', 1)::INT;
            upper_bound_minor INT := split_part(lower_bound, '.', 2)::INT + 1;
            upper_bound TEXT := upper_bound_major || '.' || upper_bound_minor || '.0';
        BEGIN
            satisfies := (version >= lower_bound AND version < upper_bound);
        END;

    ELSIF range_expression ~ '^\^\d+\.\d+\.\d+$' THEN
        -- Matches ^1.2.3 (>=1.2.3 <2.0.0)
        DECLARE
            lower_bound TEXT := regexp_replace(range_expression, '\^', '');
            upper_bound_major INT := split_part(lower_bound, '.', 1)::INT + 1;
            upper_bound TEXT := upper_bound_major || '.0.0';
        BEGIN
            satisfies := (version >= lower_bound AND version < upper_bound);
        END;

    -- [Added] 1) Single major version pattern '^(\d+)$'
    ELSIF range_expression ~ '^\d+$' THEN
        /*
            e.g.) "1" is interpreted as (>=1.0.0 <2.0.0) in semver range
                  "2" would be interpreted as (>=2.0.0 <3.0.0)
         */
        DECLARE
            major_range INT := range_expression::INT;
            lower_bound TEXT := major_range || '.0.0';
            upper_bound TEXT := (major_range + 1) || '.0.0';
        BEGIN
            satisfies := (version >= lower_bound AND version < upper_bound);
        END;

    -- [Added] 2) major.x pattern '^(\d+)\.x$'
    ELSIF range_expression ~ '^\d+\.x$' THEN
        /*
            e.g.) "2.x" => as long as major=2 matches, any minor and patch is OK
                  effectively works like (>=2.0.0 <3.0.0)
         */
        DECLARE
            major_range INT := split_part(range_expression, '.', 1)::INT;
            lower_bound TEXT := major_range || '.0.0';
            upper_bound TEXT := (major_range + 1) || '.0.0';
        BEGIN
            satisfies := (version >= lower_bound AND version < upper_bound);
        END;

    ELSE
        RAISE EXCEPTION 'Unsupported range expression: %', range_expression;
    END IF;

    RETURN satisfies;
END;
$$ LANGUAGE plpgsql;

-- HotUpdater.semver_satisfies
DROP FUNCTION IF EXISTS semver_satisfies;

-- HotUpdater.get_update_info
DROP FUNCTION IF EXISTS get_update_info;

-- HotUpdater.get_update_info
CREATE OR REPLACE FUNCTION get_update_info (
    app_platform   platforms,
    app_version text,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_app_version_list text[]
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            'UPDATE' AS status
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND b.id > min_bundle_id
          AND b.target_app_version IN (SELECT unnest(target_app_version_list))
          AND b.channel = target_channel
        ORDER BY b.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            b.id,
            TRUE AS should_force_update,
            b.message,
            'ROLLBACK' AS status
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
          AND b.id > min_bundle_id
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM bundles b
          WHERE b.id = bundle_id
            AND b.enabled = TRUE
            AND b.platform = app_platform
      );
END;
$$;

-- HotUpdater.bundles
ALTER TABLE bundles
ADD COLUMN channel text NOT NULL DEFAULT 'production';

ALTER TABLE bundles
DROP COLUMN file_url;

-- HotUpdater.get_target_app_version_list

CREATE OR REPLACE FUNCTION get_target_app_version_list (
    app_platform platforms,
    min_bundle_id uuid
)
RETURNS TABLE (
    target_app_version text
)
LANGUAGE plpgsql
AS
$$
BEGIN
    RETURN QUERY
    SELECT b.target_app_version
    FROM bundles b 
    WHERE b.platform = app_platform
    AND b.id >= min_bundle_id
    GROUP BY b.target_app_version;
END;
$$;

-- HotUpdater.get_channels
CREATE OR REPLACE FUNCTION get_channels ()
RETURNS TABLE (
    channel text
)
LANGUAGE plpgsql
AS
$$
BEGIN
    RETURN QUERY
    SELECT b.channel
    FROM bundles b 
    GROUP BY b.channel;
END;
$$;

CREATE INDEX bundles_channel_idx ON bundles(channel);

ALTER TABLE bundles ADD COLUMN IF NOT EXISTS fingerprint_hash text;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE bundles ADD COLUMN IF NOT EXISTS storage_uri TEXT;

UPDATE bundles
SET storage_uri = 'supabase-storage://%%BUCKET_NAME%%/' || id || '/bundle.zip'
WHERE storage_uri IS NULL;

ALTER TABLE bundles ALTER COLUMN storage_uri SET NOT NULL;
ALTER TABLE bundles ALTER COLUMN target_app_version DROP NOT NULL;

ALTER TABLE bundles ADD CONSTRAINT check_version_or_fingerprint CHECK (
    (target_app_version IS NOT NULL) OR (fingerprint_hash IS NOT NULL)
);

CREATE INDEX bundles_fingerprint_hash_idx ON bundles(fingerprint_hash);

DROP FUNCTION IF EXISTS get_update_info;

-- HotUpdater.get_update_info
CREATE OR REPLACE FUNCTION get_update_info_by_fingerprint_hash (
    app_platform   platforms,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_fingerprint_hash text
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            'UPDATE' AS status,
            b.storage_uri
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND b.id > min_bundle_id
          AND b.channel = target_channel
          AND b.fingerprint_hash = target_fingerprint_hash
        ORDER BY b.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            b.id,
            TRUE AS should_force_update,
            b.message,
            'ROLLBACK' AS status,
            b.storage_uri
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
          AND b.id > min_bundle_id
          AND b.channel = target_channel
          AND b.fingerprint_hash = target_fingerprint_hash
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM bundles b
          WHERE b.id = bundle_id
            AND b.enabled = TRUE
            AND b.platform = app_platform
      );
END;
$$;


-- HotUpdater.get_update_info
CREATE OR REPLACE FUNCTION get_update_info_by_app_version (
    app_platform   platforms,
    app_version text,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_app_version_list text[]
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            'UPDATE' AS status,
            b.storage_uri
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND b.id > min_bundle_id
          AND b.target_app_version IN (SELECT unnest(target_app_version_list))
          AND b.channel = target_channel
        ORDER BY b.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            b.id,
            TRUE AS should_force_update,
            b.message,
            'ROLLBACK' AS status,
            b.storage_uri
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
          AND b.id > min_bundle_id
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM bundles b
          WHERE b.id = bundle_id
            AND b.enabled = TRUE
            AND b.platform = app_platform
      );
END;
$$;DROP FUNCTION IF EXISTS get_update_info_by_fingerprint_hash;
DROP FUNCTION IF EXISTS get_update_info_by_app_version;

-- HotUpdater.get_update_info
CREATE OR REPLACE FUNCTION get_update_info_by_fingerprint_hash (
    app_platform   platforms,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_fingerprint_hash text
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text,
    file_hash     text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            'UPDATE' AS status,
            b.storage_uri,
            b.file_hash
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND b.id > min_bundle_id
          AND b.channel = target_channel
          AND b.fingerprint_hash = target_fingerprint_hash
        ORDER BY b.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            b.id,
            TRUE AS should_force_update,
            b.message,
            'ROLLBACK' AS status,
            b.storage_uri,
            b.file_hash
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
          AND b.id > min_bundle_id
          AND b.channel = target_channel
          AND b.fingerprint_hash = target_fingerprint_hash
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri,
        NULL          AS file_hash
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM bundles b
          WHERE b.id = bundle_id
            AND b.enabled = TRUE
            AND b.platform = app_platform
      );
END;
$$;


-- HotUpdater.get_update_info
CREATE OR REPLACE FUNCTION get_update_info_by_app_version (
    app_platform   platforms,
    app_version text,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_app_version_list text[]
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text,
    file_hash     text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH update_candidate AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            'UPDATE' AS status,
            b.storage_uri,
            b.file_hash
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= bundle_id
          AND b.id > min_bundle_id
          AND b.target_app_version IN (SELECT unnest(target_app_version_list))
          AND b.channel = target_channel
        ORDER BY b.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            b.id,
            TRUE AS should_force_update,
            b.message,
            'ROLLBACK' AS status,
            b.storage_uri,
            b.file_hash
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id < bundle_id
          AND b.id > min_bundle_id
        ORDER BY b.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri,
        NULL          AS file_hash
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM bundles b
          WHERE b.id = bundle_id
            AND b.enabled = TRUE
            AND b.platform = app_platform
      );
END;
$$;
-- HotUpdater.bundles

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS rollout_cohort_count INTEGER DEFAULT 1000
    CHECK (rollout_cohort_count >= 0 AND rollout_cohort_count <= 1000);

CREATE INDEX IF NOT EXISTS bundles_rollout_idx ON bundles(rollout_cohort_count);

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS target_cohorts TEXT[];

CREATE INDEX IF NOT EXISTS bundles_target_cohorts_idx ON bundles
  USING GIN (target_cohorts);

-- HotUpdater.is_cohort_eligible
-- Cohort eligibility helpers matching @hot-updater/core rollout.ts

CREATE OR REPLACE FUNCTION positive_mod(
  value INTEGER,
  modulus INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN ((value % modulus) + modulus) % modulus;
END;
$$;

CREATE OR REPLACE FUNCTION hash_rollout_value(input TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  hash_value NUMERIC := 0;
  char_code INTEGER;
  i INTEGER;
BEGIN
  FOR i IN 1..length(input) LOOP
    char_code := ascii(substring(input from i for 1));
    hash_value := mod((hash_value * 31) + char_code, 4294967296);
  END LOOP;

  IF hash_value >= 2147483648 THEN
    hash_value := hash_value - 4294967296;
  END IF;

  RETURN hash_value::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_cohort_value(cohort TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
  cohort_value INTEGER;
BEGIN
  IF cohort IS NULL THEN
    RETURN NULL;
  END IF;

  normalized := lower(btrim(cohort));

  IF normalized ~ '^[0-9]+$' THEN
    cohort_value := normalized::INTEGER;
    IF cohort_value BETWEEN 1 AND 1000 THEN
      RETURN cohort_value::TEXT;
    END IF;
  END IF;

  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION gcd_int(a INTEGER, b INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  x INTEGER := abs(a);
  y INTEGER := abs(b);
  next_value INTEGER;
BEGIN
  WHILE y <> 0 LOOP
    next_value := x % y;
    x := y;
    y := next_value;
  END LOOP;

  RETURN x;
END;
$$;

CREATE OR REPLACE FUNCTION get_rollout_multiplier(bundle_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  candidate INTEGER := positive_mod(
    hash_rollout_value(bundle_id::TEXT || ':multiplier'),
    997
  );
BEGIN
  IF candidate = 0 THEN
    candidate := 1;
  END IF;

  WHILE gcd_int(candidate, 1000) <> 1 LOOP
    candidate := positive_mod(candidate + 1, 1000);
    IF candidate = 0 THEN
      candidate := 1;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION get_rollout_offset(bundle_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN positive_mod(hash_rollout_value(bundle_id::TEXT || ':offset'), 1000);
END;
$$;

CREATE OR REPLACE FUNCTION get_modular_inverse(value INTEGER, modulus INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  candidate INTEGER;
BEGIN
  FOR candidate IN 1..(modulus - 1) LOOP
    IF positive_mod(value * candidate, modulus) = 1 THEN
      RETURN candidate;
    END IF;
  END LOOP;

  RAISE EXCEPTION 'No modular inverse for % mod %', value, modulus;
END;
$$;

CREATE OR REPLACE FUNCTION is_numeric_cohort(cohort TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_cohort TEXT := normalize_cohort_value(cohort);
  cohort_value INTEGER;
BEGIN
  IF normalized_cohort IS NULL OR normalized_cohort !~ '^[0-9]+$' THEN
    RETURN FALSE;
  END IF;

  cohort_value := normalized_cohort::INTEGER;
  RETURN cohort_value BETWEEN 1 AND 1000;
END;
$$;

CREATE OR REPLACE FUNCTION get_numeric_cohort_rollout_position(
  bundle_id UUID,
  cohort TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_cohort TEXT := normalize_cohort_value(cohort);
  cohort_value INTEGER;
  multiplier INTEGER;
  offset_value INTEGER;
  inverse_multiplier INTEGER;
BEGIN
  IF NOT is_numeric_cohort(normalized_cohort) THEN
    RAISE EXCEPTION 'Invalid numeric cohort: %', cohort;
  END IF;

  cohort_value := normalized_cohort::INTEGER - 1;
  multiplier := get_rollout_multiplier(bundle_id);
  offset_value := get_rollout_offset(bundle_id);
  inverse_multiplier := get_modular_inverse(multiplier, 1000);

  RETURN positive_mod(
    inverse_multiplier * (cohort_value - offset_value),
    1000
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_cohort_eligible(
  bundle_id UUID,
  cohort TEXT,
  rollout_cohort_count INTEGER,
  target_cohorts TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_cohort TEXT := normalize_cohort_value(cohort);
  normalized_rollout_count INTEGER := COALESCE(rollout_cohort_count, 1000);
  normalized_target_cohorts TEXT[];
BEGIN
  IF target_cohorts IS NOT NULL THEN
    normalized_target_cohorts := ARRAY(
      SELECT normalize_cohort_value(value)
      FROM unnest(target_cohorts) AS value
    );
  END IF;

  IF normalized_target_cohorts IS NOT NULL
     AND array_length(normalized_target_cohorts, 1) > 0 THEN
    RETURN normalized_cohort IS NOT NULL
       AND normalized_cohort = ANY(normalized_target_cohorts);
  END IF;

  IF normalized_rollout_count <= 0 THEN
    RETURN FALSE;
  END IF;

  IF normalized_cohort IS NULL THEN
    RETURN normalized_rollout_count >= 1000;
  END IF;

  IF NOT is_numeric_cohort(normalized_cohort) THEN
    RETURN FALSE;
  END IF;

  IF normalized_rollout_count >= 1000 THEN
    RETURN TRUE;
  END IF;

  RETURN get_numeric_cohort_rollout_position(bundle_id, normalized_cohort)
    < normalized_rollout_count;
END;
$$;

-- HotUpdater.get_update_info_by_fingerprint_hash

DROP FUNCTION IF EXISTS get_update_info_by_fingerprint_hash;

CREATE OR REPLACE FUNCTION get_update_info_by_fingerprint_hash (
    app_platform   platforms,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_fingerprint_hash text,
    cohort TEXT DEFAULT NULL
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text,
    file_hash     text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH candidate_bundles AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            b.storage_uri,
            b.file_hash,
            b.rollout_cohort_count,
            b.target_cohorts
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= min_bundle_id
          AND b.channel = target_channel
          AND b.fingerprint_hash = target_fingerprint_hash
    ),
    current_candidate AS (
        SELECT
            cb.id,
            is_cohort_eligible(
                cb.id,
                cohort,
                cb.rollout_cohort_count,
                cb.target_cohorts
            ) AS is_eligible
        FROM candidate_bundles cb
        WHERE cb.id = bundle_id
        LIMIT 1
    ),
    eligible_update_candidate AS (
        SELECT
            cb.id,
            cb.should_force_update,
            cb.message,
            'UPDATE' AS status,
            cb.storage_uri,
            cb.file_hash
        FROM candidate_bundles cb
        WHERE cb.id > bundle_id
          AND is_cohort_eligible(
              cb.id,
              cohort,
              cb.rollout_cohort_count,
              cb.target_cohorts
          )
        ORDER BY cb.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            cb.id,
            TRUE AS should_force_update,
            cb.message,
            'ROLLBACK' AS status,
            cb.storage_uri,
            cb.file_hash
        FROM candidate_bundles cb
        WHERE cb.id < bundle_id
          AND NOT EXISTS (
              SELECT 1
              FROM current_candidate
              WHERE current_candidate.is_eligible = TRUE
          )
          AND NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
        ORDER BY cb.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM eligible_update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri,
        NULL          AS file_hash
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM current_candidate
          WHERE current_candidate.is_eligible = TRUE
      )
      AND NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
      AND NOT EXISTS (SELECT 1 FROM rollback_candidate);
END;
$$;

-- HotUpdater.get_update_info_by_app_version

DROP FUNCTION IF EXISTS get_update_info_by_app_version;

CREATE OR REPLACE FUNCTION get_update_info_by_app_version (
    app_platform   platforms,
    app_version text,
    bundle_id  uuid,
    min_bundle_id uuid,
    target_channel text,
    target_app_version_list text[],
    cohort TEXT DEFAULT NULL
)
RETURNS TABLE (
    id            uuid,
    should_force_update  boolean,
    message       text,
    status        text,
    storage_uri   text,
    file_hash     text
)
LANGUAGE plpgsql
AS
$$
DECLARE
    NIL_UUID CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    RETURN QUERY
    WITH candidate_bundles AS (
        SELECT
            b.id,
            b.should_force_update,
            b.message,
            b.storage_uri,
            b.file_hash,
            b.rollout_cohort_count,
            b.target_cohorts
        FROM bundles b
        WHERE b.enabled = TRUE
          AND b.platform = app_platform
          AND b.id >= min_bundle_id
          AND b.target_app_version IN (SELECT unnest(target_app_version_list))
          AND b.channel = target_channel
    ),
    current_candidate AS (
        SELECT
            cb.id,
            is_cohort_eligible(
                cb.id,
                cohort,
                cb.rollout_cohort_count,
                cb.target_cohorts
            ) AS is_eligible
        FROM candidate_bundles cb
        WHERE cb.id = bundle_id
        LIMIT 1
    ),
    eligible_update_candidate AS (
        SELECT
            cb.id,
            cb.should_force_update,
            cb.message,
            'UPDATE' AS status,
            cb.storage_uri,
            cb.file_hash
        FROM candidate_bundles cb
        WHERE cb.id > bundle_id
          AND is_cohort_eligible(
              cb.id,
              cohort,
              cb.rollout_cohort_count,
              cb.target_cohorts
          )
        ORDER BY cb.id DESC
        LIMIT 1
    ),
    rollback_candidate AS (
        SELECT
            cb.id,
            TRUE AS should_force_update,
            cb.message,
            'ROLLBACK' AS status,
            cb.storage_uri,
            cb.file_hash
        FROM candidate_bundles cb
        WHERE cb.id < bundle_id
          AND NOT EXISTS (
              SELECT 1
              FROM current_candidate
              WHERE current_candidate.is_eligible = TRUE
          )
          AND NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
        ORDER BY cb.id DESC
        LIMIT 1
    ),
    final_result AS (
        SELECT * FROM eligible_update_candidate
        UNION ALL
        SELECT * FROM rollback_candidate
        WHERE NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
    )
    SELECT *
    FROM final_result
    WHERE final_result.id != bundle_id

    UNION ALL

    SELECT
        NIL_UUID      AS id,
        TRUE          AS should_force_update,
        NULL          AS message,
        'ROLLBACK'    AS status,
        NULL          AS storage_uri,
        NULL          AS file_hash
    WHERE (SELECT COUNT(*) FROM final_result) = 0
      AND bundle_id != NIL_UUID
      AND bundle_id > min_bundle_id
      AND NOT EXISTS (
          SELECT 1
          FROM current_candidate
          WHERE current_candidate.is_eligible = TRUE
      )
      AND NOT EXISTS (SELECT 1 FROM eligible_update_candidate)
      AND NOT EXISTS (SELECT 1 FROM rollback_candidate);
END;
$$;
-- HotUpdater.is_cohort_eligible
CREATE OR REPLACE FUNCTION is_cohort_eligible(
  bundle_id UUID,
  cohort TEXT,
  rollout_cohort_count INTEGER,
  target_cohorts TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized_cohort TEXT := normalize_cohort_value(cohort);
  normalized_rollout_count INTEGER := COALESCE(rollout_cohort_count, 1000);
  normalized_target_cohorts TEXT[];
BEGIN
  IF target_cohorts IS NOT NULL THEN
    normalized_target_cohorts := ARRAY(
      SELECT normalize_cohort_value(value)
      FROM unnest(target_cohorts) AS value
    );
  END IF;

  IF normalized_target_cohorts IS NOT NULL
     AND array_length(normalized_target_cohorts, 1) > 0
     AND normalized_cohort IS NOT NULL
     AND normalized_cohort = ANY(normalized_target_cohorts) THEN
    RETURN TRUE;
  END IF;

  IF normalized_rollout_count <= 0 THEN
    RETURN FALSE;
  END IF;

  IF normalized_cohort IS NULL THEN
    RETURN normalized_rollout_count >= 1000;
  END IF;

  IF NOT is_numeric_cohort(normalized_cohort) THEN
    RETURN FALSE;
  END IF;

  IF normalized_rollout_count >= 1000 THEN
    RETURN TRUE;
  END IF;

  RETURN get_numeric_cohort_rollout_position(bundle_id, normalized_cohort)
    < normalized_rollout_count;
END;
$$;
-- HotUpdater.bundle_artifact_columns

ALTER TABLE bundles ADD COLUMN IF NOT EXISTS manifest_storage_uri text;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS manifest_file_hash text;
ALTER TABLE bundles ADD COLUMN IF NOT EXISTS asset_base_storage_uri text;

CREATE TABLE IF NOT EXISTS bundle_patches (
    id text PRIMARY KEY,
    bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    base_bundle_id uuid NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
    base_file_hash text NOT NULL,
    patch_file_hash text NOT NULL,
    patch_storage_uri text NOT NULL,
    order_index integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS bundle_patches_bundle_id_idx
    ON bundle_patches(bundle_id);
CREATE INDEX IF NOT EXISTS bundle_patches_base_bundle_id_idx
    ON bundle_patches(base_bundle_id);
-- HotUpdater.supabase_rls

ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_patches ENABLE ROW LEVEL SECURITY;

ALTER FUNCTION public.get_target_app_version_list(public.platforms, uuid)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_channels()
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.positive_mod(integer, integer)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.hash_rollout_value(text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.normalize_cohort_value(text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.gcd_int(integer, integer)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_rollout_multiplier(uuid)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_rollout_offset(uuid)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_modular_inverse(integer, integer)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_numeric_cohort(text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_numeric_cohort_rollout_position(uuid, text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_cohort_eligible(uuid, text, integer, text[])
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_update_info_by_fingerprint_hash(
  public.platforms,
  uuid,
  uuid,
  text,
  text,
  text
)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_update_info_by_app_version(
  public.platforms,
  text,
  uuid,
  uuid,
  text,
  text[],
  text
)
  SET search_path = public, pg_catalog;
