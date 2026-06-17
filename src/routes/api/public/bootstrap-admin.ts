import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const email = "jeffrinsingh854@gmail.com";
        const password = "6374880647";

        // Check if user already exists
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) {
          return new Response(JSON.stringify({ ok: false, error: listErr.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        const existing = list.users.find((u) => u.email === email);
        if (existing) {
          return Response.json({ ok: true, alreadyExists: true });
        }

        const { error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: "Admin" },
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return Response.json({ ok: true, created: true });
      },
    },
  },
});
