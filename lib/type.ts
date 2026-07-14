export type Contact = {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  created_at: string
}

export type PipelineStatus = {
  id: string
  user_id: string
  name: string
  position: number
  created_at: string
}

export type Deal = {
  id: string
  user_id: string
  contact_id: string | null
  title: string
  amount: number
  status_id: string | null
  created_at: string
}

export type DealLog = {
  id: string
  deal_id: string
  user_id: string
  content: string
  created_at: string
}

export type Task = {
  id: string
  user_id: string
  deal_id: string | null
  title: string
  description: string | null
  due_date: string
  is_completed: boolean
  created_at: string
}

export type TaskWithDeal = Task & {
  deals: { id: string; title: string } | null
}

export type CallLog = {
  id: string
  user_id: string
  deal_id: string
  direction: 'incoming' | 'outgoing'
  duration_seconds: number
  status: 'answered' | 'no_answer' | 'busy' | 'failed'
  recording_url: string | null
  created_at: string
}

export type CallLogWithDeal = CallLog & {
  deals: { id: string; title: string } | null
}

export type InstagramMessage = {
  id: string
  deal_id: string
  instagram_user_id: string
  username: string
  message_type: 'direct' | 'comment'
  text: string
  is_from_customer: boolean
  created_at: string
}

export type InstagramMessageWithDeal = InstagramMessage & {
  deals: { id: string; title: string } | null
}