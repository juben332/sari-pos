-- ============================================================
-- SARI-SARI STORE POS — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================
create type user_role       as enum ('admin', 'cashier');
create type transaction_status as enum ('completed', 'voided');
create type discount_type   as enum ('none', 'senior', 'pwd', 'employee');
create type refund_method   as enum ('cash', 'store_credit', 'exchange');
create type movement_type   as enum ('sale', 'return', 'restock', 'adjustment');

-- ============================================================
-- PROFILES (extends Supabase Auth)
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text        not null,
  role        user_role   not null default 'cashier',
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
create table categories (
  id         uuid primary key default uuid_generate_v4(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
create table products (
  id                  uuid primary key default uuid_generate_v4(),
  name                text           not null,
  category_id         uuid           references categories(id) on delete set null,
  barcode             text           unique,
  price               numeric(10,2)  not null check (price >= 0),
  cost_price          numeric(10,2)  not null default 0 check (cost_price >= 0),
  stock               integer        not null default 0 check (stock >= 0),
  low_stock_threshold integer        not null default 10,
  is_active           boolean        not null default true,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now()
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table transactions (
  id              uuid primary key default uuid_generate_v4(),
  reference_no    text           not null unique,
  cashier_id      uuid           not null references profiles(id),
  subtotal        numeric(10,2)  not null check (subtotal >= 0),
  discount_type   discount_type  not null default 'none',
  discount_amount numeric(10,2)  not null default 0 check (discount_amount >= 0),
  total           numeric(10,2)  not null check (total >= 0),
  cash_tendered   numeric(10,2)  not null check (cash_tendered >= 0),
  change_due      numeric(10,2)  not null check (change_due >= 0),
  status          transaction_status not null default 'completed',
  created_at      timestamptz    not null default now()
);

-- ============================================================
-- TRANSACTION ITEMS (snapshot at time of sale)
-- ============================================================
create table transaction_items (
  id             uuid primary key default uuid_generate_v4(),
  transaction_id uuid          not null references transactions(id) on delete cascade,
  product_id     uuid          references products(id) on delete set null,
  product_name   text          not null,  -- snapshot
  unit_price     numeric(10,2) not null,  -- snapshot
  quantity       integer       not null check (quantity > 0),
  subtotal       numeric(10,2) not null
);

-- ============================================================
-- RETURNS
-- ============================================================
create table returns (
  id             uuid primary key default uuid_generate_v4(),
  reference_no   text          not null unique,
  transaction_id uuid          not null references transactions(id),
  processed_by   uuid          not null references profiles(id),
  reason         text          not null,
  refund_method  refund_method not null,
  refund_amount  numeric(10,2) not null check (refund_amount >= 0),
  notes          text,
  created_at     timestamptz   not null default now()
);

-- ============================================================
-- RETURN ITEMS
-- ============================================================
create table return_items (
  id                  uuid primary key default uuid_generate_v4(),
  return_id           uuid          not null references returns(id) on delete cascade,
  transaction_item_id uuid          references transaction_items(id) on delete set null,
  product_id          uuid          references products(id) on delete set null,
  product_name        text          not null,  -- snapshot
  quantity            integer       not null check (quantity > 0),
  unit_price          numeric(10,2) not null,
  subtotal            numeric(10,2) not null
);

-- ============================================================
-- STOCK MOVEMENTS (audit log)
-- ============================================================
create table stock_movements (
  id              uuid primary key default uuid_generate_v4(),
  product_id      uuid          not null references products(id) on delete cascade,
  type            movement_type not null,
  quantity_change integer       not null,  -- negative = deduction
  stock_before    integer       not null,
  stock_after     integer       not null,
  reference_id    uuid,                    -- transaction_id or return_id
  performed_by    uuid          references profiles(id),
  note            text,
  created_at      timestamptz   not null default now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
create index idx_products_category   on products(category_id);
create index idx_products_active     on products(is_active);
create index idx_transactions_cashier on transactions(cashier_id);
create index idx_transactions_date   on transactions(created_at desc);
create index idx_transaction_items_tx on transaction_items(transaction_id);
create index idx_returns_transaction  on returns(transaction_id);
create index idx_stock_movements_product on stock_movements(product_id);
create index idx_stock_movements_date    on stock_movements(created_at desc);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
  before update on products
  for each row execute function update_updated_at();

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles         enable row level security;
alter table categories       enable row level security;
alter table products         enable row level security;
alter table transactions     enable row level security;
alter table transaction_items enable row level security;
alter table returns          enable row level security;
alter table return_items     enable row level security;
alter table stock_movements  enable row level security;

-- Helper: check role from profiles
create or replace function get_user_role(user_id uuid)
returns user_role as $$
  select role from profiles where id = user_id;
$$ language sql security definer;

-- Profiles: users see own, admin sees all
create policy "profiles_select" on profiles for select
  using (auth.uid() = id or get_user_role(auth.uid()) = 'admin');

create policy "profiles_insert" on profiles for insert
  with check (get_user_role(auth.uid()) = 'admin');

create policy "profiles_update" on profiles for update
  using (get_user_role(auth.uid()) = 'admin');

-- Categories: all signed-in can read, admin can write
create policy "categories_read"  on categories for select using (auth.uid() is not null);
create policy "categories_write" on categories for all using (get_user_role(auth.uid()) = 'admin');

-- Products: all signed-in can read, admin can write
create policy "products_read"  on products for select using (auth.uid() is not null);
create policy "products_write" on products for all using (get_user_role(auth.uid()) = 'admin');

-- Transactions: all signed-in can read/create
create policy "transactions_read"   on transactions for select using (auth.uid() is not null);
create policy "transactions_insert" on transactions for insert with check (auth.uid() is not null);
create policy "transactions_update" on transactions for update using (get_user_role(auth.uid()) = 'admin');

-- Transaction items: all signed-in
create policy "tx_items_read"   on transaction_items for select using (auth.uid() is not null);
create policy "tx_items_insert" on transaction_items for insert with check (auth.uid() is not null);

-- Returns: all signed-in
create policy "returns_read"   on returns for select using (auth.uid() is not null);
create policy "returns_insert" on returns for insert with check (auth.uid() is not null);

-- Return items: all signed-in
create policy "return_items_read"   on return_items for select using (auth.uid() is not null);
create policy "return_items_insert" on return_items for insert with check (auth.uid() is not null);

-- Stock movements: all signed-in can read, system writes
create policy "stock_movements_read"   on stock_movements for select using (auth.uid() is not null);
create policy "stock_movements_insert" on stock_movements for insert with check (auth.uid() is not null);

-- ============================================================
-- SEED: default categories
-- ============================================================
insert into categories (name) values
  ('Beverages'),
  ('Snacks'),
  ('Canned Goods'),
  ('Condiments'),
  ('Personal Care'),
  ('Household'),
  ('Tobacco'),
  ('Others');
