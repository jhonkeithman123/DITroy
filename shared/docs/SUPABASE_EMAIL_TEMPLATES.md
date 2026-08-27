# DITroy Supabase Email Templates

Use this template in **Supabase -> Authentication -> Email Templates -> Confirm signup**.

Set the subject to:

```text
Confirm your DITroy account
```

Paste the following into the HTML editor:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your DITroy account</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1020;color:#e5eefb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Confirm your DITroy account and open your private DITrix workspace.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:42px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#111827;border:1px solid #334155;border-radius:20px;">
            <tr>
              <td style="padding:38px 36px 34px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" valign="middle" width="44" height="44" style="width:44px;height:44px;border-radius:14px;background-color:#7c3aed;color:#ffffff;font-size:21px;font-weight:bold;">
                      D
                    </td>
                    <td style="padding-left:13px;color:#94a3b8;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">
                      DITrix personal AI
                    </td>
                  </tr>
                </table>

                <h1 style="margin:34px 0 13px;color:#f8fafc;font-size:30px;line-height:1.2;font-weight:700;">
                  Welcome to DITroy
                </h1>
                <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.65;">
                  Confirm your email address to activate your private DITroy workspace.
                </p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
                  <tr>
                    <td align="center" style="border-radius:10px;background-color:#7c3aed;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:10px;">
                        Confirm email address
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:30px 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">
                  If the button does not work, copy and paste this link into your browser:
                </p>
                <p style="margin:0;word-break:break-all;color:#a78bfa;font-size:12px;line-height:1.6;">
                  {{ .ConfirmationURL }}
                </p>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;border-top:1px solid #334155;">
                  <tr>
                    <td style="padding-top:18px;color:#64748b;font-size:12px;line-height:1.6;">
                      If you did not create a DITroy account, you can safely ignore this email.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.5;">
            DITroy, personal AI for DITrix
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Change email address

Use this in **Supabase -> Authentication -> Email Templates -> Change email address**.

Subject:

```text
Confirm your new DITroy email address
```

HTML:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm your new DITroy email address</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1020;color:#e5eefb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      Confirm {{ .NewEmail }} as your new DITroy email address.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1020;">
      <tr><td align="center" style="padding:42px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#111827;border:1px solid #334155;border-radius:20px;">
          <tr><td style="padding:38px 36px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" width="44" height="44" style="width:44px;height:44px;border-radius:14px;background-color:#7c3aed;color:#ffffff;font-size:21px;font-weight:bold;">D</td>
              <td style="padding-left:13px;color:#94a3b8;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">DITrix personal AI</td>
            </tr></table>
            <h1 style="margin:34px 0 13px;color:#f8fafc;font-size:30px;line-height:1.2;font-weight:700;">Update your email</h1>
            <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.65;">Confirm <strong style="color:#f8fafc;">{{ .NewEmail }}</strong> as the new email address for your private DITroy workspace.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td align="center" style="border-radius:10px;background-color:#7c3aed;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:10px;">Confirm new email</a></td></tr></table>
            <p style="margin:30px 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:0;word-break:break-all;color:#a78bfa;font-size:12px;line-height:1.6;">{{ .ConfirmationURL }}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;border-top:1px solid #334155;"><tr><td style="padding-top:18px;color:#64748b;font-size:12px;line-height:1.6;">If you did not request this change, you can safely ignore this email.</td></tr></table>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.5;">DITroy, personal AI for DITrix</p>
      </td></tr>
    </table>
  </body>
</html>
```

## Reset password

Use this in **Supabase -> Authentication -> Email Templates -> Reset password**.

Subject:

```text
Reset your DITroy password
```

HTML:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset your DITroy password</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b1020;color:#e5eefb;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Reset your DITroy password securely.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0b1020;">
      <tr><td align="center" style="padding:42px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#111827;border:1px solid #334155;border-radius:20px;">
          <tr><td style="padding:38px 36px 34px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td align="center" width="44" height="44" style="width:44px;height:44px;border-radius:14px;background-color:#7c3aed;color:#ffffff;font-size:21px;font-weight:bold;">D</td>
              <td style="padding-left:13px;color:#94a3b8;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;">DITrix personal AI</td>
            </tr></table>
            <h1 style="margin:34px 0 13px;color:#f8fafc;font-size:30px;line-height:1.2;font-weight:700;">Reset your password</h1>
            <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.65;">Use the button below to choose a new password for your private DITroy workspace.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;"><tr><td align="center" style="border-radius:10px;background-color:#7c3aed;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:10px;">Reset password</a></td></tr></table>
            <p style="margin:30px 0 8px;color:#94a3b8;font-size:12px;line-height:1.6;">If the button does not work, copy and paste this link into your browser:</p>
            <p style="margin:0;word-break:break-all;color:#a78bfa;font-size:12px;line-height:1.6;">{{ .ConfirmationURL }}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:34px;border-top:1px solid #334155;"><tr><td style="padding-top:18px;color:#64748b;font-size:12px;line-height:1.6;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</td></tr></table>
          </td></tr>
        </table>
        <p style="margin:20px 0 0;color:#64748b;font-size:12px;line-height:1.5;">DITroy, personal AI for DITrix</p>
      </td></tr>
    </table>
  </body>
</html>
```

## Required Supabase settings

Add your local and hosted callback URLs under **Authentication -> URL Configuration**. The current frontend sends signup confirmation users to `/auth`:

```text
http://localhost:3000/auth
https://your-production-domain.com/auth
```

The template uses `{{ .ConfirmationURL }}`, which is a Supabase-provided variable. Do not replace it with a hardcoded URL.

## Profile pictures

The frontend uploads profile pictures to a Supabase Storage bucket named `avatars`. Create the bucket in **Storage -> New bucket** with:

- Name: `avatars`
- Public bucket: enabled
- Recommended file limit: `2 MB`
- Allowed MIME types: `image/*`

Then run these policies in the Supabase SQL Editor. Each user can manage files inside their own folder, whose first path segment is their Auth user ID:

```sql
create policy "Users can upload their own avatar"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Users can update their own avatar"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');
```
