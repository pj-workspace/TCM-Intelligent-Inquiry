import type { InjectionKey } from 'vue'
import { useChat } from '@/composables/useChat'

export type ConsultChatApi = ReturnType<typeof useChat>

export const CONSULT_CHAT_KEY: InjectionKey<ConsultChatApi> =
  Symbol('consultChat')
