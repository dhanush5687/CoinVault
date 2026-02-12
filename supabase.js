// // import { createClient } from '@supabase/supabase-js';

// // const SUPABASE_URL = 'PASTE_YOUR_PROJECT_URL';
// // const SUPABASE_ANON_KEY = 'PASTE_YOUR_ANON_KEY';

// // export const supabase = createClient(
// //   SUPABASE_URL,
// //   SUPABASE_ANON_KEY
// // );

// import 'react-native-url-polyfill/auto';
// import { createClient } from '@supabase/supabase-js';

// const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
// const SUPABASE_ANON_KEY = 'YOUR_PUBLIC_ANON_KEY';

// export const supabase = createClient(
//   SUPABASE_URL,
//   SUPABASE_ANON_KEY
// );


import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://hqhacxwhzrncfucgnnz.supabase.co',
  'YOUR_ANON_PUBLIC_KEY'
);
