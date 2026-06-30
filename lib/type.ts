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