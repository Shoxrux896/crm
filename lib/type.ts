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

export type UserRole = 'admin' | 'operator'

export type Profile = {
  id: string
  full_name: string | null
  role: UserRole
}

export type LeadStatus = 'new' | 'in_progress' | 'no_answer' | 'converted' | 'rejected'

export type Lead = {
  id: string
  facebook_lead_id: string | null
  full_name: string | null
  phone_number: string | null
  email: string | null
  ad_name: string | null
  created_at: string
  status: LeadStatus
  assigned_to: string | null
  notes: string | null
}

export type TelegramMessage = {
  id: string
  update_id: number
  chat_id: number
  telegram_message_id: number | null
  sender_name: string | null
  sender_username: string | null
  message_text: string | null
  platform: 'telegram'
  deal_id: string | null
  created_at: string
}