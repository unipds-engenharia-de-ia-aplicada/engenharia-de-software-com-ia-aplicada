import { useCallback, useMemo, useRef, useState } from "react";
import { ApiClientError, postApproval, postChat } from "./api/client";
import { loadApiBaseUrl, saveApiBaseUrl } from "./api/config";
import type { TraceEventView } from "./api/types";
import { ApprovalCard } from "./components/ApprovalCard";
import { ChatThread, type ChatTurnView } from "./components/ChatThread";
import { Composer } from "./components/Composer";
import { SettingsGear } from "./components/SettingsGear";
import { TraceDrawer } from "./components/TraceDrawer";
import "./app.css";

type PendingApprovalState = {
  approvalId: string;
  summary: string;
  status: "pending" | "approved" | "denied" | "error";
  errorMessage?: string | null;
};

function newId(): string {
  return crypto.randomUUID();
}

export default function App() {
  const [apiBaseUrl, setApiBaseUrl] = useState(() => loadApiBaseUrl());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurnView[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [awaitHumanApproval, setAwaitHumanApproval] = useState(false);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<PendingApprovalState | null>(null);
  const [traceTurnId, setTraceTurnId] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const blocked = pending?.status === "pending";

  const traceEvents: TraceEventView[] = useMemo(() => {
    if (!traceTurnId) return [];
    return turns.find((turn) => turn.id === traceTurnId)?.trace ?? [];
  }, [traceTurnId, turns]);

  const finishAssistant = useCallback(
    (data: {
      answer: string;
      requestId: string;
      conversationId: string | null;
      trace: TraceEventView[];
    }) => {
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }
      setTurns((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.answer,
          httpStatus: 200,
          requestId: data.requestId,
          trace: data.trace,
        },
      ]);
    },
    [],
  );

  const sendMessage = useCallback(
    async (message: string) => {
      setLastFailedMessage(null);
      setTurns((prev) => [
        ...prev.filter((turn) => turn.role !== "system"),
        { id: newId(), role: "user", content: message },
      ]);
      setSending(true);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await postChat({
          baseUrl: apiBaseUrl,
          message,
          conversationId,
          awaitHumanApproval,
          signal: controller.signal,
        });

        if (result.kind === "pending") {
          if (result.data.conversationId) {
            setConversationId(result.data.conversationId);
          }
          setPending({
            approvalId: result.data.pending.approvalId,
            summary: result.data.pending.summary,
            status: "pending",
          });
          return;
        }

        finishAssistant({
          answer: result.data.answer,
          requestId: result.data.requestId,
          conversationId: result.data.conversationId,
          trace: result.data.trace,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const messageText =
          error instanceof ApiClientError
            ? error.message
            : "Não foi possível falar com a API";
        setLastFailedMessage(message);
        setTurns((prev) => [
          ...prev,
          {
            id: newId(),
            role: "system",
            content: "",
            httpStatus: "error",
            errorMessage: messageText,
          },
        ]);
      } finally {
        setSending(false);
        abortRef.current = null;
      }
    },
    [apiBaseUrl, awaitHumanApproval, conversationId, finishAssistant],
  );

  const decide = useCallback(
    async (decision: "approve" | "deny") => {
      if (!pending || pending.status !== "pending") return;
      setSending(true);
      try {
        const data = await postApproval({
          baseUrl: apiBaseUrl,
          approvalId: pending.approvalId,
          decision,
        });
        setPending({
          ...pending,
          status: decision === "approve" ? "approved" : "denied",
          errorMessage: null,
        });
        finishAssistant({
          answer: data.answer,
          requestId: data.requestId,
          conversationId: data.conversationId,
          trace: data.trace,
        });
      } catch (error) {
        const messageText =
          error instanceof ApiClientError
            ? error.message
            : "Falha ao enviar decisão";
        setPending({
          ...pending,
          status: "error",
          errorMessage: messageText,
        });
      } finally {
        setSending(false);
      }
    },
    [apiBaseUrl, finishAssistant, pending],
  );

  return (
    <div className="war-room">
      <header className="war-room__header">
        <div>
          <p className="eyebrow">Plantão</p>
          <h1>OpsPilot</h1>
          <p className="lede">War Room — chat operacional com raciocínio auditável.</p>
        </div>
        <SettingsGear
          open={settingsOpen}
          apiBaseUrl={apiBaseUrl}
          onOpen={() => setSettingsOpen(true)}
          onClose={() => setSettingsOpen(false)}
          onSave={(url) => setApiBaseUrl(saveApiBaseUrl(url))}
        />
      </header>

      <main className="war-room__main">
        <ChatThread
          turns={turns}
          onViewReasoning={setTraceTurnId}
          onRetry={
            lastFailedMessage
              ? () => {
                  void sendMessage(lastFailedMessage);
                }
              : undefined
          }
        />

        {pending ? (
          <ApprovalCard
            summary={pending.summary}
            status={pending.status}
            errorMessage={pending.errorMessage}
            busy={sending}
            onApprove={() => {
              void decide("approve");
            }}
            onDeny={() => {
              void decide("deny");
            }}
          />
        ) : null}

        <Composer
          disabled={blocked}
          sending={sending}
          awaitHumanApproval={awaitHumanApproval}
          onAwaitHumanApprovalChange={setAwaitHumanApproval}
          onSend={(message) => {
            void sendMessage(message);
          }}
          onAbort={() => abortRef.current?.abort()}
        />
      </main>

      <TraceDrawer
        open={traceTurnId !== null}
        events={traceEvents}
        onClose={() => setTraceTurnId(null)}
      />
    </div>
  );
}
