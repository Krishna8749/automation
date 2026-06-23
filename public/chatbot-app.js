/* ─────────────────────────────────────────────────────────────
   Premium JS Controller for Chatbot Client Website
   ───────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const chatMessages = document.getElementById('chatMessages');
  const chatInputForm = document.getElementById('chatInputForm');
  const chatMessageInput = document.getElementById('chatMessageInput');
  const sendMessageBtn = document.getElementById('sendMessageBtn');

  // Hardcoded API Key requested by the user
  const AUTH_KEY = 'sk-cgp-3eirgct19bdrvyaosz91ak';

  // Conversational History Array (OpenAI format)
  let messagesHistory = [
    { role: 'assistant', content: 'Hello! I am your persistent AI Assistant. I will remember this conversation because all my responses route to a dedicated session. How can I help you today?' }
  ];

  // Auto-resize textarea as user types
  chatMessageInput.addEventListener('input', () => {
    chatMessageInput.style.height = 'auto';
    chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight - 6, 140)}px`;
  });

  // Submit prompt on Enter (unless Shift+Enter is pressed)
  chatMessageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatInputForm.dispatchEvent(new Event('submit'));
    }
  });

  // Simple Markdown & HTML formatting helper
  function formatContent(text) {
    // 1. Escape HTML entities
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Format preformatted multi-line code blocks
    escaped = escaped.replace(/```(?:[a-zA-Z0-9]+)?\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // 3. Format inline code tags
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. Format line-breaks
    escaped = escaped.replace(/\n/g, '<br>');

    return escaped;
  }

  // Append a message bubble to history
  function appendMessageBubble(role, contentText = '') {
    const isAssistant = role === 'assistant';
    const turnDiv = document.createElement('div');
    turnDiv.className = `msg-turn ${isAssistant ? 'assistant-turn' : 'user-turn'}`;

    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'avatar-msg';
    avatarDiv.innerHTML = `<i data-lucide="${isAssistant ? 'bot' : 'user'}"></i>`;

    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'msg-bubble';
    
    if (contentText) {
      bubbleDiv.innerHTML = formatContent(contentText);
    } else {
      // Create a visual loader/typing indicator for stream loading
      bubbleDiv.innerHTML = `
        <div class="typing-indicator" id="currentLoader">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      `;
    }

    turnDiv.appendChild(avatarDiv);
    turnDiv.appendChild(bubbleDiv);
    chatMessages.appendChild(turnDiv);

    // Auto scroll down
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Refresh lucide icons
    lucide.createIcons();

    return bubbleDiv;
  }

  // Handle stream submission
  chatInputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = chatMessageInput.value.trim();
    if (!prompt) return;

    // Reset input layout
    chatMessageInput.value = '';
    chatMessageInput.style.height = 'auto';
    
    // Disable inputs during network request
    chatMessageInput.disabled = true;
    sendMessageBtn.disabled = true;

    // Add User bubble
    appendMessageBubble('user', prompt);
    messagesHistory.push({ role: 'user', content: prompt });

    // Add Assistant placeholder bubble
    const assistantBubble = appendMessageBubble('assistant');

    let assistantText = '';
    let hasCleanedLoader = false;

    try {
      // Connect to the OpenAI gateway completions endpoint
      const response = await fetch('/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AUTH_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: messagesHistory,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Save back the last partial line
        buffer = lines.pop();

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine || cleanLine === 'data: [DONE]') continue;

          if (cleanLine.startsWith('data: ')) {
            try {
              const json = JSON.parse(cleanLine.substring(6));
              const delta = json.choices?.[0]?.delta?.content || '';
              if (delta) {
                // Clear typing indicator loader on first token
                if (!hasCleanedLoader) {
                  assistantBubble.innerHTML = '';
                  hasCleanedLoader = true;
                }
                assistantText += delta;
                assistantBubble.innerHTML = formatContent(assistantText);
                chatMessages.scrollTop = chatMessages.scrollHeight;
              }
            } catch (err) {
              // Ignore partial parsing errors
            }
          }
        }
      }

      // Save complete text back into history
      messagesHistory.push({ role: 'assistant', content: assistantText });

    } catch (err) {
      console.error(err);
      if (!hasCleanedLoader) {
        assistantBubble.innerHTML = '';
      }
      assistantBubble.innerHTML = `<span style="color: var(--accent-warning);"><i data-lucide="alert-triangle" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"></i> Connection Error: ${err.message}. Please check gateway server.</span>`;
      lucide.createIcons();
    } finally {
      // Re-enable inputs
      chatMessageInput.disabled = false;
      sendMessageBtn.disabled = false;
      chatMessageInput.focus();
    }
  });

  // Render initial icons
  lucide.createIcons();
});
