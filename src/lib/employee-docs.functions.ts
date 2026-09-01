import { createServerFn } from "@tanstack/react-start";

/**
 * Employee document upload — validates CPF/password server-side via
 * public.employee_login_cpf, then uploads through the service-role client so
 * the storage bucket does not require an anonymous INSERT policy.
 */
export const employeeUploadDoc = createServerFn({ method: "POST" })
  .inputValidator(
    (i: {
      cpf: string;
      password: string;
      filename: string;
      contentType: string;
      // base64-encoded file bytes
      dataBase64: string;
    }) => i,
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // Validate employee credentials
    const { data: emp, error: authErr } = await supabaseAdmin.rpc(
      "employee_login_cpf",
      { p_cpf: data.cpf, p_password: data.password },
    );
    if (authErr) throw new Error(authErr.message);
    const employee = Array.isArray(emp) ? emp[0] : emp;
    if (!employee?.id) throw new Error("invalid_credentials");

    // Basic file constraints
    const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) throw new Error("file_too_large");

    const safeName = (data.filename || "arquivo").replace(/[^\w.\-]+/g, "_");
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
    const path = `${employee.id}/${Date.now()}.${ext}`;

    const up = await supabaseAdmin.storage
      .from("employee-docs")
      .upload(path, bytes, {
        contentType: data.contentType || "application/octet-stream",
        upsert: false,
      });
    if (up.error) throw new Error(up.error.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("employee-docs")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    if (signErr) throw new Error(signErr.message);

    return { path, url: signed?.signedUrl ?? path };
  });
