/**
 * Droneitor individual lead notification templates.
 *
 * This is an internal notification sent to the Droneitor client and 2DM admin.
 * It is always written in English, regardless of the lead's selected language.
 *
 * HTML assembly:
 *   HTML_HEAD_2DM + HTML_EN_2DM + HTML_FOOT_2DM
 *
 * Plain-text body:
 *   TEXT_EN_2DM
 *
 * Replace every placeholder before sending. Empty values should be normalized
 * by the caller to an em dash (or "Not provided") before replacement.
 */

export const SUBJECT_2DM = "Droneitor | New lead received";

export const HTML_HEAD_2DM = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Droneitor | New lead received</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f5f5; color:#152945; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">A new lead was received through fly.droneitor.com.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; background-color:#f5f5f5;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; border-collapse:collapse; background-color:#ffffff; border:1px solid #cccccc;">
          <tr>
            <td style="padding:24px; text-align:center; border-bottom:4px solid #c9603c;">
              <img src="cid:2dm-logo" alt="Tu Digital Marketing" width="150" style="display:block; width:150px; max-width:100%; height:auto; margin:0 auto 10px auto; border:0; outline:none; text-decoration:none;" />
              <div style="font-size:20px; line-height:1.25; font-weight:bold; color:#152945;">Tu Digital Marketing</div>
              <div style="margin-top:3px; font-size:12px; line-height:1.4; color:#c9603c;">Marketing for Creators</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 12px 24px;">
`;

export const HTML_EN_2DM = `              <div lang="en" style="color:#152945;">
                <p style="margin:0 0 16px 0; font-size:14px; line-height:1.5;">Hi Marco and Julian,</p>
                <p style="margin:0 0 20px 0; font-size:14px; line-height:1.5;">A new lead was received on <strong>{created_at_formatted} (Miami time)</strong>.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; table-layout:fixed; font-family:Arial, Helvetica, sans-serif; font-size:14px; line-height:1.5;">
                  <tr>
                    <td colspan="2" style="padding:10px 15px; border:1px solid #cccccc; background-color:#f5f5f5; color:#152945; font-size:12px; font-weight:bold; letter-spacing:0.4px;">CONTACT INFORMATION</td>
                  </tr>
                  <tr>
                    <td width="34%" style="width:34%; padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Lead ID</td>
                    <td width="66%" style="width:66%; padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{lead_id}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Name</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{name}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Email</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{email}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Phone</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{phone}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Received</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{created_at_formatted} (Miami time)</td>
                  </tr>

                  <tr>
                    <td colspan="2" style="padding:10px 15px; border:1px solid #cccccc; background-color:#f5f5f5; color:#152945; font-size:12px; font-weight:bold; letter-spacing:0.4px;">PROJECT DETAILS</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Project Type</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{project_type}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Language</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{lang}</td>
                  </tr>

                  <tr>
                    <td colspan="2" style="padding:10px 15px; border:1px solid #cccccc; background-color:#f5f5f5; color:#152945; font-size:12px; font-weight:bold; letter-spacing:0.4px;">CAMPAIGN ATTRIBUTION (UTM PARAMETERS)</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Source</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{utm_source}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Medium</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{utm_medium}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Campaign</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{utm_campaign}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Content</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{utm_content}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Term</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{utm_term}</td>
                  </tr>

                  <tr>
                    <td colspan="2" style="padding:10px 15px; border:1px solid #cccccc; background-color:#f5f5f5; color:#152945; font-size:12px; font-weight:bold; letter-spacing:0.4px;">LOCATION &amp; DEVICE</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">Location</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{country}, {region}, {city}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">User Agent</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{user_agent}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#152945; color:#ffffff; font-weight:bold; vertical-align:top;">IP Address</td>
                    <td style="padding:10px 15px; border:1px solid #cccccc; background-color:#ffffff; color:#152945; vertical-align:top; overflow-wrap:anywhere; word-break:break-word;">{ip}</td>
                  </tr>
                </table>

                <p style="margin:20px 0 8px 0; font-size:14px; line-height:1.5;">This lead was captured through <a href="https://fly.droneitor.com" style="color:#c9603c; text-decoration:underline;">fly.droneitor.com</a> and is now in your Droneitor database.</p>
                <p style="margin:0; font-size:14px; line-height:1.5;">Best regards,<br /><strong>Tu Digital Marketing</strong></p>
              </div>
`;

export const HTML_FOOT_2DM = `            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 24px 24px; border-top:1px solid #cccccc; background-color:#f5f5f5; text-align:center; color:#152945;">
              <div style="font-size:14px; line-height:1.4; font-weight:bold; color:#152945;">Tu Digital Marketing</div>
              <div style="margin-top:2px; font-size:12px; line-height:1.4; color:#666666;">Marketing for Creators</div>
              <div style="margin-top:12px; font-size:12px; line-height:1.7; color:#152945;">
                <a href="https://tudigitalmarketing.com" style="color:#c9603c; text-decoration:underline;">TuDigitalMarketing.com</a><br />
                <a href="mailto:contacto@tudigitalmarketing.com" style="color:#c9603c; text-decoration:underline;">contacto@tudigitalmarketing.com</a><br />
                <a href="https://wa.me/524521284165" style="color:#c9603c; text-decoration:underline;">WhatsApp: +52 (452) 128-4165</a>
              </div>
              <div style="margin-top:12px; font-size:11px; line-height:1.5; color:#666666;">Internal lead notification service</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export const TEXT_EN_2DM = `Hi Marco and Julian,

A new lead was received on {created_at_formatted} (Miami time).

CONTACT INFORMATION
-------------------------------- | ---------------------------------------------
Lead ID                          | {lead_id}
Name                             | {name}
Email                            | {email}
Phone                            | {phone}
Received                         | {created_at_formatted} (Miami time)

PROJECT DETAILS
-------------------------------- | ---------------------------------------------
Project Type                     | {project_type}
Language                         | {lang}

CAMPAIGN ATTRIBUTION (UTM PARAMETERS)
-------------------------------- | ---------------------------------------------
Source                           | {utm_source}
Medium                           | {utm_medium}
Campaign                         | {utm_campaign}
Content                          | {utm_content}
Term                             | {utm_term}

LOCATION & DEVICE
-------------------------------- | ---------------------------------------------
Location                         | {country}, {region}, {city}
User Agent                       | {user_agent}
IP Address                       | {ip}

This lead was captured through fly.droneitor.com and is now in your Droneitor database.

Best regards,
Tu Digital Marketing
Marketing for Creators

Website: TuDigitalMarketing.com
Email: contacto@tudigitalmarketing.com
WhatsApp: +52 (452) 128-4165
`;
