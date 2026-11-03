import type { ChatApp } from '@shared/apiContract'
import { formatComment } from '../vault/taskComments'

// "Run ChatGPT Desktop" and "Run Claude Desktop" open a new chat in a desktop
// app through its link scheme. The chat works in `folder`, a full path, and
// the prompt fills its message box: the app sends nothing until you press Enter.

type Agent = {
  name: string
  // A link back to the agent's chat, with `{id}` for the chat's id.
  chatLink: string
  // The environment variable that holds that id in the agent's shell.
  idVariable: string
}

// ChatGPT runs the Codex agent, which sets CODEX_THREAD_ID. Claude Desktop
// sets CLAUDE_CODE_HOST_SESSION_ID to its `local_` session id, which its
// `code/continue` link opens.
const agents: Record<ChatApp, Agent> = {
  chatgpt: { name: 'ChatGPT', chatLink: 'codex://threads/{id}', idVariable: 'CODEX_THREAD_ID' },
  claude: { name: 'Claude', chatLink: 'claude://code/continue?session={id}', idVariable: 'CLAUDE_CODE_HOST_SESSION_ID' },
}

type TaskPromptInput = {
  app: ChatApp
  line: string
  // The full path of the note that holds the task.
  notePath: string
  // When the chat opens, as `2026-11-03 14:30`.
  time: string
}

// Asks for help with the task, and asks the agent to note on the task, in the
// form the Comments column reads, that it is running and where its chat is.
export const createTaskPrompt = ({ app, line, notePath, time }: TaskPromptInput): string => {
  const { name, chatLink, idVariable } = agents[app]
  const comment = formatComment({ time, text: `Agent is running in ${chatLink}` })

  return [
    `Help me with this task ${line.trim()} ${notePath}.`,
    `Before you start, add this comment to that task's line in the note: ${comment}, with {id} replaced by the value of the ${idVariable} environment variable. If that variable is empty, write ${name} in place of the link. ` +
      'A comment is [comment_YYYY-MM-DD HH:mm:: text] with the local date and time. It goes after the task text and its other comments, before its dates and fields, such as 📅 2026-11-05.',
  ].join('\n\n')
}

const encode = encodeURIComponent

// ChatGPT keeps the `codex://` scheme of the Codex app; Claude opens a Claude
// Code session, and asks before it works in a folder that comes from a link.
const createLink: Record<ChatApp, (folder: string, prompt: string) => string> = {
  chatgpt: (folder, prompt) => `codex://threads/new?path=${encode(folder)}&prompt=${encode(prompt)}`,
  claude: (folder, prompt) => `claude://code/new?folder=${encode(folder)}&q=${encode(prompt)}`,
}

export const createChatLink = (app: ChatApp, folder: string, prompt: string): string =>
  createLink[app](folder, prompt)
