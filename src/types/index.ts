export interface Group {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface Member {
  id: string
  group_id: string
  name: string
  email: string | null
  created_at: string
}

export interface Expense {
  id: string
  group_id: string
  paid_by: string
  description: string
  amount: number
  date: string
  created_at: string
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  member_id: string
  amount: number
}

export interface ExpenseWithSplits extends Expense {
  splits: ExpenseSplit[]
  payer?: Member
}

export interface Balance {
  member: Member
  owes: { to: Member; amount: number }[]
  owed: { by: Member; amount: number }[]
  net: number
}
