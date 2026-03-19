const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = 'notifications@romantechsolutions.net';
const FROM_NAME = 'Roman Tech Solutions';

// 4 Aces recipients
const RECIPIENTS = [
  '4AcesAutogroup@Comcast.net',
  'JHodge662@gmail.com'
];

exports.handler = async (event) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  // Vapi wraps everything in payload.message
  const message = payload.message || payload;
  const eventType = message.type || payload.type;

  // Only process end-of-call reports
  if (eventType !== 'end-of-call-report') {
    return { statusCode: 200, body: JSON.stringify({ received: true, skipped: true }) };
  }

  const call = message.call || {};
  const transcript = message.transcript || '';
  const summary = message.summary || '';
  const startedAt = call.startedAt ? new Date(call.startedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Unknown';
  const endedAt = call.endedAt ? new Date(call.endedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'Unknown';
  const callerNumber = call.customer?.number || 'Unknown Number';
  const durationSeconds = call.endedAt && call.startedAt
    ? Math.round((new Date(call.endedAt) - new Date(call.startedAt)) / 1000)
    : 0;
  const durationFormatted = durationSeconds > 60
    ? `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`
    : `${durationSeconds}s`;

  // Detect language from transcript
  const spanishIndicators = ['hola', 'gracias', 'carro', 'auto', 'precio', 'quiero', 'habla', 'español', 'tiene', 'cuánto'];
  const isSpanish = spanishIndicators.some(word => transcript.toLowerCase().includes(word));
  const languageTag = isSpanish ? '🇪🇸 Spanish Call' : '🇺🇸 English Call';

  // Extract caller intent from transcript - look for User lines only
  const userLines = transcript
    .split('\n')
    .filter(line => line.toLowerCase().startsWith('user:') || line.toLowerCase().startsWith('customer:'))
    .map(line => line.replace(/^(user|customer):\s*/i, '').trim())
    .filter(line => line.length > 2)
    .slice(0, 5)
    .join('\n• ');

  // Build email
  const subject = `📞 New 4 Aces Call — ${callerNumber} (${durationFormatted})`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: #1e3a5f; color: white; padding: 20px 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.8; }
    .body { padding: 24px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .info-box { background: #f8f9fa; border-left: 3px solid #1e6fe0; padding: 12px; border-radius: 4px; }
    .info-box .label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-box .value { font-size: 15px; font-weight: bold; color: #1a1a1a; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .section h3 { font-size: 13px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; margin: 0 0 8px; }
    .section p { background: #f8f9fa; padding: 12px; border-radius: 4px; margin: 0; font-size: 14px; line-height: 1.6; color: #333; }
    .transcript-box { background: #f8f9fa; padding: 12px; border-radius: 4px; font-size: 13px; line-height: 1.7; color: #444; max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; background: #e8f4e8; color: #2d7a2d; }
    .badge.spanish { background: #fff3e0; color: #e65100; }
    .footer { background: #f8f9fa; padding: 16px 24px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📞 New Call — 4 Aces Auto Group</h1>
      <p>Powered by Roman Tech Solutions AI</p>
    </div>
    <div class="body">

      <div class="info-grid">
        <div class="info-box">
          <div class="label">Caller</div>
          <div class="value">${callerNumber}</div>
        </div>
        <div class="info-box">
          <div class="label">Duration</div>
          <div class="value">${durationFormatted}</div>
        </div>
        <div class="info-box">
          <div class="label">Called At</div>
          <div class="value">${startedAt}</div>
        </div>
        <div class="info-box">
          <div class="label">Language</div>
          <div class="value">${languageTag}</div>
        </div>
      </div>

      ${summary ? `
      <div class="section">
        <h3>📋 Call Summary</h3>
        <p>${summary}</p>
      </div>
      ` : ''}

      ${userLines ? `
      <div class="section">
        <h3>💬 What the Caller Said</h3>
        <p>• ${userLines}</p>
      </div>
      ` : ''}

      ${transcript ? `
      <div class="section">
        <h3>📄 Full Transcript</h3>
        <div class="transcript-box">${transcript.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      </div>
      ` : ''}

    </div>
    <div class="footer">
      Roman Tech Solutions &bull; AI Phone Automation &bull; romantechsolutions.net
    </div>
  </div>
</body>
</html>`;

  // Send via SendGrid
  try {
    const toArray = RECIPIENTS.map(email => ({ email }));

    const sgResponse = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: toArray, subject }],
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject,
        content: [{ type: 'text/html', value: htmlBody }]
      })
    });

    if (!sgResponse.ok) {
      const errText = await sgResponse.text();
      console.error('SendGrid error:', errText);
      return { statusCode: 500, body: `SendGrid error: ${errText}` };
    }

    console.log(`✅ 4 Aces notification sent for call from ${callerNumber}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, caller: callerNumber, duration: durationFormatted })
    };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: `Error: ${err.message}` };
  }
};
