// Codex owner qualification fixture. SSR only: no hydration, model or transport.
import { Conversation, ConversationContent } from "./vendor/ai-elements/conversation";
import { Message, MessageContent } from "./vendor/ai-elements/message";
import {
  PromptInput,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./vendor/ai-elements/prompt-input";

export interface FixtureText {
  readonly userText: string;
  readonly assistantText: string;
  readonly promptText: string;
}

export const SYNTHETIC_TEXT: FixtureText = {
  userText: "Synthetic user message",
  assistantText: "Synthetic assistant response",
  promptText: "Qualification fixture: sending is disabled",
};

export function ElementsFixture(text: FixtureText = SYNTHETIC_TEXT) {
  return (
    <section aria-label="AI Elements qualification fixture">
      <p role="status">Synthetic display only. Sending is unavailable.</p>
      <Conversation aria-label="Synthetic conversation">
        <ConversationContent>
          <Message from="user">
            <MessageContent><p>{text.userText}</p></MessageContent>
          </Message>
          <Message from="assistant">
            <MessageContent><p>{text.assistantText}</p></MessageContent>
          </Message>
        </ConversationContent>
      </Conversation>
      {/* The entire upstream form, including its hidden file input, is disabled. */}
      <fieldset disabled aria-label="Disabled synthetic prompt">
        <PromptInput
          globalDrop={false}
          syncHiddenInput={false}
          multiple={false}
          maxFiles={0}
          onSubmit={(_message, event) => event.preventDefault()}
        >
          <PromptInputTextarea
            aria-label="Synthetic prompt text"
            disabled
            readOnly
            defaultValue={text.promptText}
          />
          <PromptInputSubmit disabled>Sending unavailable</PromptInputSubmit>
        </PromptInput>
      </fieldset>
    </section>
  );
}
