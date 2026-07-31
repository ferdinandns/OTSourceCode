package notification

type TemplateEmail string

const (
  // NotifyReviewer: sent to QS when a repair is finished and needs verification.
  // Params order: sarprasName, sarprasCode, picName, notes, url
  NotifyReviewer TemplateEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#f59e0b;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fde68a;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Quality Verification</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Perbaikan Siap Diverifikasi</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Pekerjaan perbaikan sarana/prasarana berikut telah dinyatakan selesai oleh PIC terkait dan menunggu proses verifikasi dari Tim Quality System.</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">PIC Pelaksana</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Catatan Perbaikan</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Verifikasi Sekarang</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  // InspectionReminderOverdue: sent when an inspection has passed its due date.
  // Params order: sarprasCode, url
  InspectionReminderOverdue TemplateEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#dc2626;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Overdue Notice</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Pemeriksaan Melewati Batas Waktu</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Pemeriksaan rutin untuk sarpras <strong style="color:#0f172a;">%s</strong> telah melewati batas waktu yang ditentukan. Mohon segera lakukan pemeriksaan untuk menjaga kepatuhan operasional.</p>
              <div style="text-align:center;margin-top:8px;">
                <a href="%s" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat Tugas Pemeriksaan</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  // InspectionReminder: sent ahead of an inspection's due date.
  // Params order: sarprasCode, daysDiff, url
  InspectionReminder TemplateEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#3b82f6;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#bfdbfe;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Inspection Reminder</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Pengingat Jadwal Pemeriksaan</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Pemeriksaan rutin untuk sarpras <strong style="color:#0f172a;">%s</strong> akan jatuh tempo dalam <strong style="color:#0f172a;">%d hari</strong>. Mohon pastikan pemeriksaan dilakukan sebelum batas waktu berakhir.</p>
              <div style="text-align:center;margin-top:8px;">
                <a href="%s" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat Tugas Pemeriksaan</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  // NotifyApprovalsToSpvQs: sent to approvers for a general approval request.
  // Params order: subject, requesterName, entityType, action, identifier, notes, url
  NotifyApprovalsToSpvQs = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#16a34a;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#bbf7d0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Approval Required</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">%s</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Terdapat pengajuan baru yang membutuhkan peninjauan dan persetujuan Anda dengan rincian sebagai berikut:</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:100px;vertical-align:top;">Pemohon</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Menu</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Aksi</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Item</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Catatan</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Tinjau &amp; Proses Persetujuan</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

  // NotifyApproversForBulkSarpras: sent for a bulk (Excel) import approval request.
  // Params order: requesterName, itemCount, notes, url
  NotifyApproversForBulkSarpras = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#16a34a;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#bbf7d0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Bulk Import Approval</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Pengajuan Import Massal Sarpras</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Terdapat pengajuan impor data sarpras secara massal (bulk import) yang membutuhkan persetujuan Anda.</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:100px;vertical-align:top;">Pemohon</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Jumlah Item</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%d sarpras</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Catatan</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Tinjau &amp; Proses Persetujuan</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

  // NotifyNewInspection: sent to checkers when a new inspection schedule is ready.
  // Params order: sarprasName, sarprasCode, url
  NotifyNewInspection = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#3b82f6;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#bfdbfe;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">New Task</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Jadwal Pemeriksaan Baru</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Terdapat jadwal pemeriksaan sarpras baru pada departemen Anda yang siap untuk dikerjakan:</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:120px;vertical-align:top;">Menu</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">Pemeriksaan Sarpras</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Jenis Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#3b82f6;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat &amp; Ambil Tugas</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

  // NotifyRepairPIC: sent to the assigned technician (PIC) for a repair job.
  // Params order: sarprasName, sarprasCode, notes, url
  NotifyRepairPIC = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#dc2626;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Repair Assignment</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Penugasan Perbaikan Sarpras</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Anda telah ditunjuk sebagai PIC (Person in Charge) untuk melakukan perbaikan sarpras dengan rincian sebagai berikut:</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Catatan/Kerusakan</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat Detail Perbaikan</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

  // NotifyAPARMarksUsed: sent to General Affairs when QS marks APAR/APAB units as used.
  // Params order: count, markerName, reason, url
  NotifyAPARMarksUsed = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#dc2626;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill Required</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">APAR/APAB Telah Digunakan</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Tim Quality System (QS) telah menandai unit APAR/APAB berikut sebagai telah digunakan. Mohon segera lakukan proses pengisian ulang (refill).</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jumlah Unit</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%d unit</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Ditandai Oleh</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Keterangan</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat Monitoring Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

  // NotifyRefillReminder: sent when an APAR/APAB has expired but refill is already in progress.
  // Params order: sarprasName, sarprasCode, url
  NotifyRefillReminder = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#e11d48;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecdd3;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill Reminder</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">APAR/APAB Melewati Masa Berlaku</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Hasil pemeriksaan terbaru menunjukkan bahwa sarpras berikut telah melewati masa berlaku (expired) dan memerlukan pengisian ulang (refill):</p>

              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>

              <p style="margin:20px 0 0;line-height:1.6;color:#64748b;font-size:13px;">Proses refill sudah berjalan. Mohon segera diselesaikan agar status APAR kembali normal.</p>

              <div style="text-align:center;margin-top:20px;">
                <a href="%s" style="display:inline-block;background:#e11d48;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Lihat Detail Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

    NotifyExpiryWarning = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">

            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

              <tr>
                <td style="background:#d97706;padding:22px 32px;">
                  <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">
                    EMERTRACK
                  </h2>
                  <p style="margin:5px 0 0;color:#fde68a;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                    Expiry Warning
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">

                  <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
                    Masa Berlaku APAR/APAB Akan Segera Habis
                  </h3>

                  <p style="margin:0 0 20px;line-height:1.6;color:#334155;">
                    Sarpras berikut akan melewati masa berlaku (expired) dalam
                    <strong>%d hari</strong>. Mohon segera lakukan persiapan pengisian ulang (refill)
                    agar tidak melewati batas waktu.
                  </p>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                    style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 18px;">

                        <table style="width:100%%;border-collapse:collapse;font-size:13px;">

                          <tr>
                            <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">
                              Jenis Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Nomor Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Tanggal Kedaluwarsa
                            </td>
                            <td style="padding:6px 0;color:#b45309;font-weight:700;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Sisa Waktu
                            </td>
                            <td style="padding:6px 0;color:#b45309;font-weight:700;">
                              %d hari lagi
                            </td>
                          </tr>

                        </table>

                      </td>
                    </tr>
                  </table>

                  <div style="text-align:center;margin-top:28px;">
                    <a href="%s"
                      style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">
                      Ajukan Refill Sekarang
                    </a>
                  </div>

                </td>
              </tr>

              <tr>
                <td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">
                    EMERTRACK
                  </p>
                  <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                    Email ini dikirim secara otomatis oleh sistem EMERTRACK.
                    Mohon tidak membalas email ini secara langsung.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `

    NotifyExpiryOverdue = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr>
          <td align="center">

            <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
              style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">

              <tr>
                <td style="background:#dc2626;padding:22px 32px;">
                  <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">
                    EMERTRACK
                  </h2>
                  <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">
                    Expiry Overdue
                  </p>
                </td>
              </tr>

              <tr>
                <td style="padding:32px;">

                  <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">
                    APAR/APAB Telah Melewati Masa Berlaku
                  </h3>

                  <p style="margin:0 0 20px;line-height:1.6;color:#334155;">
                    Sarpras berikut telah <strong>melewati masa berlaku (expired)</strong>
                    dan memerlukan pengisian ulang (refill) segera. Mohon segera ditindaklanjuti
                    agar status sarpras kembali normal.
                  </p>

                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0"
                    style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                    <tr>
                      <td style="padding:16px 18px;">

                        <table style="width:100%%;border-collapse:collapse;font-size:13px;">

                          <tr>
                            <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">
                              Jenis Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Nomor Sarpras
                            </td>
                            <td style="padding:6px 0;color:#0f172a;font-weight:600;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Tanggal Kedaluwarsa
                            </td>
                            <td style="padding:6px 0;color:#dc2626;font-weight:700;">
                              %s
                            </td>
                          </tr>

                          <tr>
                            <td style="padding:6px 0;color:#64748b;vertical-align:top;">
                              Status
                            </td>
                            <td style="padding:6px 0;color:#dc2626;font-weight:700;">
                              EXPIRED
                            </td>
                          </tr>

                        </table>

                      </td>
                    </tr>
                  </table>

                  <div style="margin-top:20px;padding:14px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;">
                    <strong style="color:#b91c1c;">Tindakan yang perlu dilakukan:</strong>
                    <ul style="margin:10px 0 0 18px;padding:0;color:#475569;line-height:1.8;">
                      <li>Segera ajukan proses pengisian ulang (refill).</li>
                      <li>Unggah bukti refill melalui EMERTRACK setelah selesai.</li>
                      <li>Pastikan tanggal kedaluwarsa baru diperbarui di sistem.</li>
                    </ul>
                  </div>

                  <div style="text-align:center;margin-top:28px;">
                    <a href="%s"
                      style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">
                      Ajukan Refill Sekarang
                    </a>
                  </div>

                </td>
              </tr>

              <tr>
                <td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
                  <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">
                    EMERTRACK
                  </p>
                  <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">
                    Email ini dikirim secara otomatis oleh sistem EMERTRACK.
                    Mohon tidak membalas email ini secara langsung.
                  </p>
                </td>
              </tr>

            </table>

          </td>
        </tr>
      </table>
    </body>
    </html>
    `

    RefillPOReminderApproaching = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#d97706;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fde68a;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill PO Reminder</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Batas Waktu PO Refill Akan Segera Habis</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Bukti refill untuk sarpras berikut belum diunggah, dan batas waktu PO akan habis dalam <strong>%d hari</strong>. Mohon segera unggah bukti refill.</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor PO</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Batas Waktu PO</td><td style="padding:6px 0;color:#b45309;font-weight:700;">%s</td></tr>
                  </table>
                </td></tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Unggah Bukti Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

    RefillPOReminderOverdue = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#dc2626;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#fecaca;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill PO Overdue</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Batas Waktu PO Refill Telah Terlewat</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Bukti refill untuk sarpras berikut <strong>belum diunggah</strong> dan batas waktu PO sudah terlewat. Mohon segera selesaikan proses refill dan unggah bukti.</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr><td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor PO</td><td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Batas Waktu PO</td><td style="padding:6px 0;color:#dc2626;font-weight:700;">%s</td></tr>
                    <tr><td style="padding:6px 0;color:#64748b;vertical-align:top;">Status</td><td style="padding:6px 0;color:#dc2626;font-weight:700;">OVERDUE</td></tr>
                  </table>
                </td></tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Unggah Bukti Refill</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>`

    NotifyRefillEvidenceEmail = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;font-size:14px;color:#1e293b;background:#f4f7f9;">
      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
        <tr><td align="center">
          <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr><td style="background:#003d7a;padding:22px 32px;">
              <h2 style="margin:0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:0.04em;">EMERTRACK</h2>
              <p style="margin:5px 0 0;color:#9bb9d6;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Refill Verification</p>
            </td></tr>
            <tr><td style="padding:32px;">
              <h3 style="margin:0 0 16px;font-size:17px;font-weight:700;color:#0f172a;">Bukti Refill Siap Diverifikasi</h3>
              <p style="margin:0 0 20px;line-height:1.6;color:#334155;">Bukti pengisian ulang (refill) APAR/APAB berikut telah diunggah oleh Tim GA dan menunggu proses verifikasi dari Tim Quality System.</p>
              <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
                <tr><td style="padding:16px 18px;">
                  <table style="width:100%%;border-collapse:collapse;font-size:13px;">
                    <tr>
                      <td style="padding:6px 0;color:#64748b;width:140px;vertical-align:top;">Jenis Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Nomor Sarpras</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Diunggah Oleh</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Tanggal Kedaluwarsa Baru</td>
                      <td style="padding:6px 0;color:#0f172a;font-weight:600;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;color:#64748b;vertical-align:top;">Catatan Refill</td>
                      <td style="padding:6px 0;color:#0f172a;">%s</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
              <div style="text-align:center;margin-top:28px;">
                <a href="%s" style="display:inline-block;background:#003d7a;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:13px;">Verifikasi Sekarang</a>
              </div>
            </td></tr>
            <tr><td style="background:#eef4fa;padding:18px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#003d7a;">EMERTRACK</p>
              <p style="margin:0;font-size:11px;line-height:1.6;color:#64748b;">Email ini dikirim secara otomatis oleh sistem EMERTRACK. Mohon tidak membalas email ini secara langsung.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `
)
