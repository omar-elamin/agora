export interface Guide {
  title: string;
  description: string;
  content: string;
}

export const guides: Record<string, Guide> = {
  twilio: {
    title: "Twilio",
    description: "Forward Twilio ConversationRelay's BCP-47 lang parameter to Agora's speaker_locale for precision temperature routing. A 5-minute integration with zero extra API calls.",
    content: `# Agora + Twilio ConversationRelay: Forward \`lang\` → \`speaker_locale\`

**Audience:** Twilio developer building an AI voice app with ConversationRelay
**Time to integrate:** ~5 minutes
**Date:** 2026-03-20

---

## What this does

Twilio's ConversationRelay passes a BCP-47 \`lang\` parameter in the initial prompt message. Agora's \`speaker_locale\` session parameter accepts BCP-47 natively — forwarding it unlocks precision temperature routing and improves confidence calibration by up to **13.5% ECE** for native English speakers.

No language detection. No extra API calls. Just pass what Twilio already gives you.

---

## Integration

When ConversationRelay starts a session, it sends a \`prompt\` message with a \`lang\` field. Extract it and pass it to Agora at session creation:

\`\`\`javascript
// In your ConversationRelay WebSocket handler
ws.on('message', async (data) => {
  const msg = JSON.parse(data);

  if (msg.type === 'prompt' && msg.lang) {
    // Forward Twilio's BCP-47 lang directly into Agora
    const session = await agora.sessions.create({
      speaker_locale: msg.lang,   // e.g. "en-US", "de-DE", "ar-SA"
      // ...your other session params
    });
  }
});
\`\`\`

That's it.

---

## What Agora does with it

| \`lang\` value from Twilio | Agora routes to | ECE vs baseline |
|--------------------------|-----------------|-----------------|
| \`en-US\`, \`en-GB\`, \`en-AU\`, \`en-CA\`, \`en-NZ\`, \`en-IE\` | T=1.0 (Native EN) | −13.5% |
| \`de-DE\`, \`de-AT\`, \`nl-NL\` | T=2.0 (Germanic) | −86% |
| \`fa-IR\` | T=1.5 (Farsi) | — |
| \`ar-*\`, \`hi-IN\`, \`ur-PK\` | T=6.5 (High-T) | −84–85% |
| \`ta-IN\`, \`te-IN\` | T=3.25 + WER flag | — |
| anything else / null | T=4.0 (standard default) | baseline |

Unknown BCP-47 tags fall through to T=4.0 — no errors, no broken sessions.

---

## Why not let Agora detect locale automatically?

Automated native EN detection via Whisper confidence signals tops out at **64% precision** — not good enough for production routing. Explicit \`speaker_locale\` achieves ~95%+ precision with zero latency cost. Twilio already does the work; you just need to pass the signal.

---

## Notes

- \`speaker_locale\` is session-level. Set it once at session creation; it applies to all requests in that session.
- If \`lang\` is absent in Twilio's prompt (rare — some older ConversationRelay configs omit it), Agora defaults to T=4.0 — safe, no action required.
- For per-request locale overrides (multi-speaker sessions), see the Agora API spec — this is planned for v1.1.

---

*Questions? → [agora docs] or reach out directly.*`,
  },

  genesys: {
    title: "Genesys",
    description: "Pass Genesys Cloud Architect's detected language to Agora's speaker_locale via a Data Action webhook for locale-aware confidence calibration.",
    content: `# Agora + Genesys Cloud: Forward Detected Language → \`speaker_locale\`

**Audience:** Genesys Cloud administrator or developer building a multilingual contact center flow
**Time to integrate:** ~15 minutes
**Date:** 2026-03-20

---

## What this does

Genesys Cloud Architect flows can detect a caller's language via the **DetectLanguage** or **Set Language** actions — setting it right at the start of the interaction. Agora's \`speaker_locale\` session parameter accepts BCP-47 natively. Forwarding what Genesys already knows unlocks precision temperature routing, improving confidence calibration by up to **13.5% ECE** for native English speakers and up to **86% ECE** for Germanic and high-T accent groups.

No extra language detection. No audio analysis. Just pass the signal Genesys already has.

---

## Integration

The pattern: at the start of your Architect flow, read the detected language, then POST it to Agora via a **Data Action** webhook when creating the session.

### Step 1: Capture language in your Architect flow

Use the **DetectLanguage** action (or **Set Language** if you set it manually) early in your inbound call flow. The result is stored as a conversation language attribute in BCP-47 format (e.g. \`en-US\`, \`de-DE\`, \`ar-SA\`).

If you're already routing callers to language-specific queues, the language is set. You don't need to re-detect it — just read it.

\`\`\`
[Call Start]
    → DetectLanguage action (or Set Language from IVR selection)
    → language stored as conversation attribute: e.g. "en-US"
    → [Create Agora Session] ← Data Action webhook
\`\`\`

### Step 2: Create a Data Action to call Agora

In **Genesys Admin → Integrations → Actions**, create a new custom Data Action with the following configuration:

**Request:**
\`\`\`json
POST https://api.agora.ai/v1/sessions
Authorization: Bearer {{YOUR_AGORA_API_KEY}}
Content-Type: application/json

{
  "speaker_locale": "\${flow.detectedLanguage}",
  "caller_phone": "\${flow.ani}"
}
\`\`\`

- \`flow.detectedLanguage\` — the BCP-47 language set by DetectLanguage / Set Language in your Architect flow
- \`flow.ani\` — caller's phone number in E.164 format (optional; used as fallback if language is null)

**Response mapping:**
\`\`\`json
{
  "session_id": "$.session_id",
  "t_class": "$.t_class",
  "optimal_T": "$.optimal_T"
}
\`\`\`

### Step 3: Call the Data Action from your flow

In your Architect flow, add a **Call Data Action** step after language detection:

\`\`\`
[DetectLanguage]
    → [Call Data Action: Create Agora Session]
        input:  flow.detectedLanguage → speaker_locale
                flow.ani             → caller_phone
        output: session_id stored as flow.agoraSessionId
\`\`\`

Store the returned \`session_id\` as a flow variable — pass it in all subsequent Agora API calls for this interaction.

That's it.

---

## What Agora does with it

| Language detected in Architect | Agora routes to | ECE vs baseline |
|-------------------------------|-----------------|-----------------|
| \`en-US\`, \`en-GB\`, \`en-AU\`, \`en-CA\`, \`en-NZ\`, \`en-IE\` | T=1.0 (Native EN) | −13.5% |
| \`de-DE\`, \`de-AT\`, \`nl-NL\` | T=2.0 (Germanic) | −86% |
| \`fa-IR\` | T=1.5 (Farsi) | — |
| \`ar-*\`, \`hi-IN\`, \`ur-PK\` | T=6.5 (High-T) | −84–85% |
| \`ta-IN\`, \`te-IN\` | T=3.25 + WER flag | — |
| anything else / null | T=4.0 (standard default) | baseline |

Unknown BCP-47 tags fall through to T=4.0 — no errors, no broken sessions.

---

## Why not let Agora detect locale automatically?

Automated native EN detection via Whisper confidence signals tops out at **64% precision** — not good enough for production routing. Explicit \`speaker_locale\` achieves ~95%+ precision with zero latency cost. Genesys already does the language detection work in your IVR; you just need to pass the signal downstream.

---

## Notes

- \`speaker_locale\` is session-level. Set it once at session creation; it applies to all requests in that session.
- If \`DetectLanguage\` returns null (e.g. caller hung up early, detection inconclusive), Agora defaults to T=4.0 — safe, no action required.
- If your flow doesn't use language detection today but does route callers to language-specific queues (e.g. "Press 2 for Spanish"), the queue assignment implies a locale. You can map queue name → BCP-47 and pass it via Set Language before calling the Data Action.
- \`caller_phone\` (ANI) is optional. If \`speaker_locale\` is null, Agora falls back to deriving a locale estimate from the E.164 country code (~80–85% precision for Native EN). This is a zero-effort fallback — Genesys exposes ANI on every inbound call.
- For per-request locale overrides (multi-speaker sessions), see the Agora API spec — planned for v1.1.

---

*Questions? → [agora docs] or reach out directly.*`,
  },

  avaya: {
    title: "Avaya",
    description: "Integrate Avaya Experience Platform with Agora's speaker_locale using a REST API task to forward detected language for precision temperature routing.",
    content: `# Agora + Avaya Experience Platform: Forward Detected Language → \`speaker_locale\`

**Audience:** Avaya Experience Platform (AXP) administrator or developer building a multilingual contact center flow
**Time to integrate:** ~20 minutes
**Date:** 2026-03-20

---

## What this does

Avaya Experience Platform (AXP) Workflows expose a **REST API task** that lets you call external APIs mid-flow. If your AXP flow uses AI Virtual Agent language detection, IVR language selection, or Avaya's multilingual routing — you're already capturing the caller's language. Agora's \`speaker_locale\` session parameter accepts BCP-47 natively. Forwarding what AXP already knows unlocks precision temperature routing, improving confidence calibration by up to **13.5% ECE** for native English speakers and up to **86% ECE** for Germanic and high-T accent groups.

No extra language detection. No audio analysis. Just pass the signal AXP already has.

---

## Integration

The pattern: at the start of your AXP Workflow, capture the detected language, then call Agora via a **REST API task** when creating the session.

### Step 1: Capture language in your AXP Workflow

AXP surfaces caller language in a few common ways. Use whichever matches your setup:

**Option A — AI Virtual Agent detection (recommended)**
If you're running an Avaya AI Virtual Agent (Dialogflow or native), language is auto-detected and set as a workflow variable. Reference it directly.

**Option B — IVR language selection**
If callers press a digit to select their language (e.g. "Press 1 for English, 2 for Spanish"), map the DTMF input to BCP-47 inside the Workflow using a **Set Variable** task:

\`\`\`
DTMF "1" → en-US
DTMF "2" → es-ES
DTMF "3" → de-DE
DTMF "4" → ar-SA
\`\`\`

Store the result in a workflow variable — e.g. \`detectedLocale\`.

**Option C — Language-specific queue routing**
If you already route callers to language-specific queues (e.g. \`Queue_German\`, \`Queue_Arabic\`), you can infer the locale from the queue name using a **Decision** task and store it as a variable before the REST call.

\`\`\`
[Call Start]
    → [Language detection / IVR / queue routing]
    → detectedLocale = "de-DE"  (or however you're capturing it)
    → [REST API task: Create Agora Session]
\`\`\`

### Step 2: Add a REST API task to call Agora

In your AXP Workflow, add a **REST API task** (found under the Integration tasks panel) and configure it as follows:

**Method:** POST
**URL:** \`https://api.agora.ai/v1/sessions\`

**Headers:**
\`\`\`
Authorization: Bearer {{YOUR_AGORA_API_KEY}}
Content-Type: application/json
\`\`\`

**Request body:**
\`\`\`json
{
  "speaker_locale": "{{detectedLocale}}",
  "caller_phone": "{{flow.ani}}"
}
\`\`\`

- \`detectedLocale\` — the BCP-47 language variable set in Step 1 (e.g. \`en-US\`, \`de-DE\`, \`ar-SA\`)
- \`flow.ani\` — caller's phone number in E.164 format (optional; used as fallback if locale is null)

**Response mapping** (using AXP's JSONPath extractor):
\`\`\`
$.session_id  → flow.agoraSessionId
$.t_class     → flow.agoraClass
$.optimal_T   → flow.agoraOptimalT
\`\`\`

### Step 3: Store the session ID and continue the flow

After the REST task succeeds, \`flow.agoraSessionId\` is available for all subsequent steps in the workflow. Pass it in any further Agora API calls for this interaction.

\`\`\`
[REST API task: Create Agora Session]
    → on success: store agoraSessionId, continue flow
    → on failure: log error, continue with default routing (Agora is non-blocking)
\`\`\`

Always configure the failure branch — a non-2xx from Agora should not break your call flow. Failing gracefully means callers still reach an agent; they just lose locale-aware temperature routing for that session.

---

## AXP CPaaS path (alternative)

If you're on **Avaya OneCloud CPaaS** rather than AXP Workflows, the integration looks slightly different. Your application receives an inbound webhook when a call arrives. At that point, extract locale from IVR input or Dialogflow detection, then call Agora before returning your inboundXML response:

\`\`\`javascript
// Express.js webhook handler
app.post('/inbound-call', async (req, res) => {
  const ani = req.body.From;  // E.164 caller ANI from CPaaS

  // Locale from a prior IVR prompt result, or Dialogflow detection
  const detectedLocale = req.body.DetectResult || req.body.lang || null;

  // Create Agora session with locale
  const session = await fetch('https://api.agora.ai/v1/sessions', {
    method: 'POST',
    headers: {
      'Authorization': \\\`Bearer \\\${process.env.AGORA_API_KEY}\\\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      speaker_locale: detectedLocale,  // null → Agora defaults to T=4.0
      caller_phone: ani
    })
  }).then(r => r.json());

  const agoraSessionId = session.session_id;

  // Continue building your inboundXML response, passing agoraSessionId as needed
  res.type('text/xml').send(\\\`<Response>...</Response>\\\`);
});
\`\`\`

---

## What Agora does with it

| Language detected in AXP | Agora routes to | ECE vs baseline |
|--------------------------|-----------------|-----------------|
| \`en-US\`, \`en-GB\`, \`en-AU\`, \`en-CA\`, \`en-NZ\`, \`en-IE\` | T=1.0 (Native EN) | −13.5% |
| \`de-DE\`, \`de-AT\`, \`nl-NL\` | T=2.0 (Germanic) | −86% |
| \`fa-IR\` | T=1.5 (Farsi) | — |
| \`ar-*\`, \`hi-IN\`, \`ur-PK\` | T=6.5 (High-T) | −84–85% |
| \`ta-IN\`, \`te-IN\` | T=3.25 + WER flag | — |
| anything else / null | T=4.0 (standard default) | baseline |

Unknown BCP-47 tags fall through to T=4.0 — no errors, no broken sessions.

---

## Why not let Agora detect locale automatically?

Automated native EN detection via Whisper confidence signals tops out at **64% precision** — not good enough for production routing. Explicit \`speaker_locale\` achieves ~95%+ precision with zero latency cost. AXP already does language detection in your IVR or Virtual Agent; you just need to pass the signal downstream.

---

## Notes

- \`speaker_locale\` is session-level. Set it once at session creation; it applies to all requests in that session.
- If locale is null (detection inconclusive, caller hung up early, IVR skipped), Agora defaults to T=4.0 — safe, no action required.
- If your flow doesn't detect language but does route callers to language-specific queues, the queue implies a locale. Map queue name → BCP-47 in a Decision task and pass it. Zero extra infrastructure needed.
- \`caller_phone\` (ANI) is optional. If \`speaker_locale\` is null, Agora falls back to deriving a locale estimate from the E.164 country code (~80–85% precision for Native EN). AXP exposes ANI on every inbound call via \`flow.ani\`.
- The REST API task in AXP Workflows supports retry configuration — recommend 1 retry with 500ms delay. Agora sessions are idempotent per session; retries are safe.
- For per-request locale overrides (multi-speaker sessions), see the Agora API spec — planned for v1.1.

---

*Questions? → [agora docs] or reach out directly.*`,
  },

  "cisco-webex": {
    title: "Cisco Webex",
    description: "Forward Cisco Webex Contact Center's detected language to Agora's speaker_locale via an HTTP Request activity for locale-aware confidence calibration.",
    content: `# Agora + Cisco Webex Contact Center: Forward Detected Language → \`speaker_locale\`

**Audience:** Cisco Webex Contact Center administrator or developer building a multilingual contact center flow
**Time to integrate:** ~20 minutes
**Date:** 2026-03-20

---

## What this does

Cisco Webex Contact Center (Webex CC) Flow Designer includes an **HTTP Request** activity that lets you call external APIs mid-flow. If your Webex CC flow uses IVR language selection, Cisco's built-in language prompts, or virtual agent language detection — you're already capturing the caller's language. Agora's \`speaker_locale\` session parameter accepts BCP-47 natively. Forwarding what Webex CC already knows unlocks precision temperature routing, improving confidence calibration by up to **13.5% ECE** for native English speakers and up to **86% ECE** for Germanic and high-T accent groups.

No extra language detection. No audio analysis. Just pass the signal Webex CC already has.

---

## Integration

The pattern: at the start of your Flow Designer flow, capture the detected language, then call Agora via an **HTTP Request** activity when creating the session.

### Step 1: Capture language in your Flow Designer flow

Webex CC surfaces caller language in a few common ways. Use whichever matches your setup:

**Option A — Virtual Agent language detection (recommended)**
If you're running a Cisco Virtual Agent (CCAI / Google CCAI integration), language is detected during the IVR leg and stored as a flow variable. Reference it directly — typically exposed as \`virtualAgentLanguage\` or the language output of a **Virtual Agent V2** activity.

**Option B — IVR language selection via DTMF**
If callers press a digit to select their language, use a **Menu** activity and map each branch to a BCP-47 tag using **Set Variable** activities:

\`\`\`
Branch "1" → Set Variable: detectedLocale = "en-US"
Branch "2" → Set Variable: detectedLocale = "es-ES"
Branch "3" → Set Variable: detectedLocale = "de-DE"
Branch "4" → Set Variable: detectedLocale = "ar-SA"
\`\`\`

**Option C — Language-specific queue routing**
If callers are already routing to language-specific queues (e.g. \`Queue_German\`, \`Queue_Arabic\`), use a **Condition** activity to infer locale from the queue assignment and store it in a flow variable before the HTTP Request step.

\`\`\`
[New Phone Contact]
    → [Virtual Agent / Menu / Condition]
    → detectedLocale = "de-DE"  (or however you're capturing it)
    → [HTTP Request: Create Agora Session]
\`\`\`

### Step 2: Add an HTTP Request activity to call Agora

In Flow Designer, drag an **HTTP Request** activity from the activity library and connect it after your language detection step. Configure it as follows:

**Method:** POST
**URL:** \`https://api.agora.ai/v1/sessions\`

**Request Headers:**
\`\`\`
Authorization: Bearer {{YOUR_AGORA_API_KEY}}
Content-Type: application/json
\`\`\`

**Request Body** (select "JSON" body type):
\`\`\`json
{
  "speaker_locale": "{{detectedLocale}}",
  "caller_phone": "{{NewPhoneContact.ANI}}"
}
\`\`\`

- \`detectedLocale\` — the BCP-47 language variable set in Step 1 (e.g. \`en-US\`, \`de-DE\`, \`ar-SA\`)
- \`NewPhoneContact.ANI\` — caller's phone number in E.164 format (optional; used as fallback if locale is null). Available on every inbound call via the built-in \`NewPhoneContact\` event output.

**Response Parsing** (using the HTTP Request activity's Parse Settings):

| Variable name | Path expression | Type |
|---|---|---|
| \`Global_agoraSessionId\` | \`$.session_id\` | String |
| \`Global_agoraTClass\` | \`$.t_class\` | String |
| \`Global_agoraOptimalT\` | \`$.optimal_T\` | Decimal |

> Use \`Global_\` prefix to make these variables accessible across subsequent activities in the flow.

### Step 3: Handle success and failure branches

The HTTP Request activity has two output branches: **Success** (2xx) and **Failure** (non-2xx / timeout). Wire both:

\`\`\`
[HTTP Request: Create Agora Session]
    → Success: store Global_agoraSessionId, continue flow
    → Failure: log error via Set Variable, continue with default routing
\`\`\`

Always configure the failure branch. A non-2xx from Agora should not drop or stall the call. Failing gracefully means callers still reach an agent — they just won't have locale-aware temperature routing for that session.

In the **Advanced Settings** of the HTTP Request activity, set:
- **Connection Timeout:** 3000 ms
- **Response Timeout:** 5000 ms

These are safe for Agora's API latency and won't introduce noticeable delay in your flow.

---

## What Agora does with it

| Language detected in Webex CC | Agora routes to | ECE vs baseline |
|-------------------------------|-----------------|-----------------|
| \`en-US\`, \`en-GB\`, \`en-AU\`, \`en-CA\`, \`en-NZ\`, \`en-IE\` | T=1.0 (Native EN) | −13.5% |
| \`de-DE\`, \`de-AT\`, \`nl-NL\` | T=2.0 (Germanic) | −86% |
| \`fa-IR\` | T=1.5 (Farsi) | — |
| \`ar-*\`, \`hi-IN\`, \`ur-PK\` | T=6.5 (High-T) | −84–85% |
| \`ta-IN\`, \`te-IN\` | T=3.25 + WER flag | — |
| anything else / null | T=4.0 (standard default) | baseline |

Unknown BCP-47 tags fall through to T=4.0 — no errors, no broken sessions.

---

## Why not let Agora detect locale automatically?

Automated native EN detection via Whisper confidence signals tops out at **64% precision** — not good enough for production routing. Explicit \`speaker_locale\` achieves ~95%+ precision with zero latency cost. Webex CC already does language detection in your IVR or Virtual Agent; you just need to pass the signal downstream.

---

## Legacy path: Cisco UCCE / UCCX (on-premises)

If you're on **Cisco Unified CCE or UCCX** rather than Webex CC cloud, the integration uses a different mechanism. UCCX exposes a **REST step** in the Script Editor (Cisco Unified CCX Editor), and UCCE can call external APIs via a **Courtesy Callback** or CVP micro-application. The recommended approach for UCCE is a CVP VXML application with an inline HTTP fetch:

\`\`\`javascript
// CVP VXML / ECMAScript block
var xhr = new XMLHttpRequest();
xhr.open("POST", "https://api.agora.ai/v1/sessions", false);  // sync for VXML context
xhr.setRequestHeader("Authorization", "Bearer " + agoraApiKey);
xhr.setRequestHeader("Content-Type", "application/json");
xhr.send(JSON.stringify({
  speaker_locale: session.get("detectedLocale"),   // from IVR digit or Language Media Step
  caller_phone: session.get("callerANI")           // E.164 from ANI variable
}));

var resp = JSON.parse(xhr.responseText);
session.set("agoraSessionId", resp.session_id);
\`\`\`

For UCCX, use the **HTTP REST step** in the script editor and map response fields to session variables in the same way.

---

## Notes

- \`speaker_locale\` is session-level. Set it once at session creation; it applies to all requests in that session.
- If locale is null (detection inconclusive, caller hung up early, IVR skipped), Agora defaults to T=4.0 — safe, no action required.
- If your flow doesn't detect language but does route callers to language-specific queues, the queue implies a locale. Map queue name → BCP-47 in a Condition activity and pass it. Zero extra infrastructure needed.
- \`caller_phone\` (ANI) is optional. If \`speaker_locale\` is null, Agora falls back to deriving a locale estimate from the E.164 country code (~80–85% precision for Native EN). Webex CC exposes ANI on every inbound call via \`NewPhoneContact.ANI\`.
- The HTTP Request activity in Flow Designer does not natively support retry on failure — if retry logic matters for your deployment, wrap the activity in a **Goto** loop (max 1 retry) with a 500ms delay using a **Wait** activity. Agora sessions are idempotent per session; retries are safe.
- Webex CC Flow Designer variables are case-sensitive. Double-check variable names match exactly between Set Variable and HTTP Request activities.
- For per-request locale overrides (multi-speaker sessions), see the Agora API spec — planned for v1.1.

---

*Questions? → [agora docs] or reach out directly.*`,
  },
};
