export type ChatLanguage = "es" | "en";
// Bounded ES/EN heuristic over trusted user messages, not fixture/tool text.
// Ambiguous inputs retain the last detected language; English is the fallback.
export function chatLanguage(
  messages: Array<{ role: string; content: string | null }>,
): ChatLanguage {
  let language: ChatLanguage = "en";
  for (const message of messages) {
    if (
      message.role !== "user" ||
      !message.content ||
      message.content === "Confirm these explicit human decisions"
    )
      continue;
    const text = message.content
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    if (
      /(?:respond|reply|answer).*\bspanish\b|(?:responde|responder).*\bespanol\b/.test(
        text,
      )
    ) {
      language = "es";
      continue;
    }
    if (
      /(?:respond|reply|answer).*\benglish\b|(?:responde|responder).*\bingles\b/.test(
        text,
      )
    ) {
      language = "en";
      continue;
    }
    const es = (
      text.match(
        /\b(hola|buenos|buenas|dias|necesito|quiero|puedes|ayuda|como|cual|procesa|si|procesar|registra|registrar|buzon|contratos|mensajes|pendientes|genera|alertas|confirmo|continua|continuar|gracias|por|favor|revisa|fecha|muestra|solicita)\b/g,
      ) ?? []
    ).length;
    const en = (
      text.match(
        /\b(hello|hi|yes|process|register|mailbox|contracts|messages|pending|generate|alerts|confirm|continue|thanks|please|review|show|reference)\b/g,
      ) ?? []
    ).length;
    if (es > en) language = "es";
    else if (en > es) language = "en";
  }
  return language;
}
const spanish: Record<string, string> = {
  "Tool failed": "La herramienta falló",
  "Unknown tool": "Herramienta desconocida",
  "Invalid tool arguments": "Argumentos de herramienta inválidos",
  "Tool arguments are not valid JSON":
    "Los argumentos de la herramienta no son JSON válido",
  "Tool execution failed": "La herramienta no pudo completar la operación",
  "No previous pending review exists for this session.":
    "No existe una revisión previa pendiente para esta sesión.",
  "An explicit human confirmation message is required.":
    "Se requiere un mensaje explícito de confirmación humana.",
  "Confirmation must identify the exact pending candidate.":
    "La confirmación debe identificar el candidato pendiente exacto.",
  "The master changed after this review. Extract and review a new candidate.":
    "El maestro cambió después de esta revisión. Extraiga y revise un nuevo candidato.",
  "The explicitly confirmed candidate was processed.":
    "El candidato confirmado explícitamente fue procesado.",
  "Confirmation was not applied. Supply all missing essential values.":
    "La confirmación no se aplicó. Proporcione todos los valores esenciales faltantes.",
  "A pending candidate still needs your explicit values and confirmation; no new write was authorized.":
    "El candidato pendiente aún requiere sus valores explícitos y confirmación; no se autorizó ninguna escritura nueva.",
  "Token budget reached. Completed actions are shown above; no further model call was made.":
    "Se alcanzó el presupuesto de tokens. Las acciones completadas se muestran arriba; no se realizó otra llamada al modelo.",
  "Token budget exhausted. Model-requested actions were not executed.":
    "Se agotó el presupuesto de tokens. No se ejecutaron las acciones solicitadas por el modelo.",
  "Model provider failed. The session is preserved; retry later.":
    "El proveedor del modelo falló. La sesión se conserva; revise el historial antes de reintentar.",
  "Model provider is unavailable. The session is preserved; retry later.":
    "El proveedor del modelo no está disponible. La sesión se conserva; revise el historial antes de reintentar.",
  "Model provider timed out. The session is preserved; retry later.":
    "El proveedor del modelo excedió el tiempo de espera. La sesión se conserva; revise el historial antes de reintentar.",
  "Model provider is not configured. Add OPENAI_API_KEY to the backend environment.":
    "El proveedor del modelo no está configurado. Configure OPENAI_API_KEY en el entorno del backend.",
  "Model provider rate limit reached. Retry later.":
    "Se alcanzó el límite de solicitudes del proveedor. Reintente más tarde.",
  "Model provider request failed. Check backend configuration and account access.":
    "La solicitud al proveedor falló. Revise la configuración del backend y el acceso de la cuenta.",
  "Model provider returned an invalid response.":
    "El proveedor del modelo devolvió una respuesta inválida.",
  "Processing finished for this turn.":
    "El procesamiento de este turno finalizó.",
  "No contractual facts were returned by tools. Ask me to process the mailbox or request alerts with a reference date.":
    "No se recibieron hechos contractuales de las herramientas. Solicite procesar el buzón o generar alertas con una fecha de referencia.",
  "Provider returned too many tool calls. No actions from this response were executed.":
    "El proveedor devolvió demasiadas llamadas a herramientas. No se ejecutaron acciones de esa respuesta.",
  "Human review is pending; later actions from this response are cancelled.":
    "Hay una revisión humana pendiente; se cancelaron las acciones posteriores de esa respuesta.",
  "Processing paused for an explicit human decision.":
    "El procesamiento se pausó para una decisión humana explícita.",
  "Iteration limit reached. Completed actions are shown above; ask to continue the remaining work.":
    "Se alcanzó el límite de iteraciones. Las acciones completadas se muestran arriba; solicite continuar el trabajo pendiente.",
  "The model cannot authorize human confirmation.":
    "El modelo no puede autorizar una confirmación humana.",
  "Only unchanged tool-produced candidates are accepted; request human edits through confirmation.":
    "Solo se aceptan candidatos sin cambios producidos por herramientas; solicite las correcciones humanas mediante la confirmación.",
  "Durable token budget or session lease unavailable. No model call was made.":
    "El presupuesto persistente o la autorización temporal de la sesión no está disponible. No se llamó al modelo.",
  "Durable usage reservation unavailable. No model call was made; inspect quota state before retrying.":
    "La reserva persistente de uso no está disponible. No se llamó al modelo; revise la cuota antes de reintentar.",
  "Usage settlement is unavailable. Inspect durable state before retrying.":
    "No se pudo conciliar el uso. Revise el estado persistente antes de reintentar.",
  "Model provider failed; uncertain usage remains reserved.":
    "El proveedor falló; el uso incierto permanece reservado.",
  "Provider usage exceeded its reserved bound. Further actions are blocked pending inspection.":
    "El uso del proveedor superó el límite reservado. Las acciones quedan bloqueadas hasta su revisión.",
  "Usage settlement is unavailable. No model-requested actions were executed; inspect durable state.":
    "No se pudo conciliar el uso. No se ejecutaron las acciones del modelo; revise el estado persistente.",
};
export function chatText(text: string, language: ChatLanguage): string {
  if (language === "en") return text;
  return (
    spanish[text] ??
    "La operación no pudo completarse. Revise la traza y el estado conservado antes de reintentar."
  );
}
export function actionText(action: string, language: ChatLanguage): string {
  return language === "es"
    ? ({
        create: "creado",
        update: "actualizado",
        duplicate: "duplicado",
        reject: "rechazado",
      }[action] ?? action)
    : action;
}
