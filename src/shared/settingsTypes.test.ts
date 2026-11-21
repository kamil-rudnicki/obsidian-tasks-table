import { describe, expect, test } from 'vitest'
import { chatPromptMessage, defaultChatPrompt, isChatPrompt, settingsPatchSchema } from './settingsTypes'

const parsePrompt = (chatPrompt: string) => settingsPatchSchema.safeParse({ chatPrompt })

describe('chat prompt setting', () => {
  test('accepts an empty prompt, which means the default', () => {
    expect(parsePrompt('  ').data).toEqual({ chatPrompt: '' })
    expect(isChatPrompt(defaultChatPrompt)).toBe(true)
  })

  test('accepts a prompt with both placeholders and trims it', () => {
    expect(parsePrompt('\n Review {task} in {note}, then plan it.\n').data).toEqual({
      chatPrompt: 'Review {task} in {note}, then plan it.',
    })
  })

  test('accepts a prompt without {comment}, which asks for no comment', () => {
    expect(parsePrompt('Review {task} in {note}.').success).toBe(true)
  })

  test('rejects a prompt without the task or the note', () => {
    for (const prompt of ['Review {task}. {comment}', 'Review the task in {note}.', 'Review {Task} in {Note}.']) {
      const result = parsePrompt(prompt)
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(chatPromptMessage)
    }
  })

  test('rejects a prompt that is too long for a link', () => {
    expect(parsePrompt(`{task} {note} ${'a'.repeat(4000)}`).success).toBe(false)
  })
})
