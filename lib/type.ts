export type Contact = {
  id: string
  user_id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  created_at: string
}

export type Deal = {
  id: string
  user_id: string
  contact_id: string | null
  title: string
  amount: number
  status: 'new' | 'in_progress' | 'closed'
  created_at: string
}   