import { supabase } from "../../supabase";

export const saveUserToDB = async (user) => {
  if (!user) return;

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      email: user.email,
      provider: user.app_metadata?.provider || "email",
    });

  if (error) {
    console.log("DB save error:", error.message);
  }
};
