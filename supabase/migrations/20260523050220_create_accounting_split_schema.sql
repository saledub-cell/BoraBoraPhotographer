/*
  # Accounting Split App Schema

  1. New Tables
    - `groups` — a named collection of people sharing expenses
      - `id` (uuid, PK)
      - `name` (text, required)
      - `description` (text, optional)
      - `created_at` (timestamptz)
    - `members` — people who belong to a group
      - `id` (uuid, PK)
      - `group_id` (uuid, FK -> groups)
      - `name` (text, required)
      - `email` (text, optional)
      - `created_at` (timestamptz)
    - `expenses` — a shared expense within a group
      - `id` (uuid, PK)
      - `group_id` (uuid, FK -> groups)
      - `paid_by` (uuid, FK -> members)
      - `description` (text, required)
      - `amount` (numeric, required)
      - `date` (date, required)
      - `created_at` (timestamptz)
    - `expense_splits` — how an expense is divided among members
      - `id` (uuid, PK)
      - `expense_id` (uuid, FK -> expenses)
      - `member_id` (uuid, FK -> members)
      - `amount` (numeric, required)

  2. Security
    - RLS enabled on all tables
    - All tables are publicly accessible (unauthenticated app — no user auth required)
    - Policies allow full read/write for all authenticated and anon requests
      (appropriate for a shared household/group app without per-user auth)

  3. Notes
    - `amount` stored as numeric(10,2) for precise money handling
    - Indexes on foreign keys for query performance
*/

CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  paid_by uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expense_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS members_group_id_idx ON members(group_id);
CREATE INDEX IF NOT EXISTS expenses_group_id_idx ON expenses(group_id);
CREATE INDEX IF NOT EXISTS expense_splits_expense_id_idx ON expense_splits(expense_id);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read groups"
  ON groups FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert groups"
  ON groups FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update groups"
  ON groups FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete groups"
  ON groups FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read members"
  ON members FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert members"
  ON members FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update members"
  ON members FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete members"
  ON members FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read expenses"
  ON expenses FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert expenses"
  ON expenses FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update expenses"
  ON expenses FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete expenses"
  ON expenses FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Anyone can read expense_splits"
  ON expense_splits FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Anyone can insert expense_splits"
  ON expense_splits FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can update expense_splits"
  ON expense_splits FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete expense_splits"
  ON expense_splits FOR DELETE TO anon, authenticated USING (true);
