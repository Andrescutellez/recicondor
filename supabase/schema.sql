-- ============================================================
-- ECA - Sistema de Gestión de Reciclaje
-- Database Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table profiles (
  id uuid references auth.users primary key,
  name text not null,
  role text not null check (role in ('admin', 'operator', 'auditor')),
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- MATERIALS
-- ============================================================
create table materials (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  unit text default 'kg',
  active boolean default true,
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

-- ============================================================
-- CASH REGISTERS
-- ============================================================
create table cash_registers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null check (type in ('main', 'operator')),
  operator_id uuid references profiles(id),
  balance numeric(15,2) default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- CASH MOVEMENTS (ledger - never delete)
-- ============================================================
create table cash_movements (
  id uuid primary key default uuid_generate_v4(),
  cash_register_id uuid references cash_registers(id) not null,
  type text not null check (type in ('income', 'expense', 'transfer_in', 'transfer_out')),
  amount numeric(15,2) not null,
  reference_type text, -- 'purchase', 'sale', 'expense', 'transfer', 'manual'
  reference_id uuid,
  description text,
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- PROVIDERS
-- ============================================================
create table providers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text check (type in ('street', 'recycler', 'company', 'other')),
  phone text,
  notes text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- PURCHASES
-- ============================================================
create table purchases (
  id uuid primary key default uuid_generate_v4(),
  operator_id uuid references profiles(id),
  provider_id uuid references providers(id),
  cash_register_id uuid references cash_registers(id),
  total numeric(15,2) not null,
  date timestamptz default now(),
  notes text,
  status text default 'active' check (status in ('active', 'reversed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- PURCHASE ITEMS
-- ============================================================
create table purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references purchases(id) not null,
  material_id uuid references materials(id) not null,
  quantity numeric(15,3) not null,
  price_per_unit numeric(15,2) not null,
  total numeric(15,2) not null
);

-- ============================================================
-- INVENTORY (current state per material)
-- ============================================================
create table inventory (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid references materials(id) unique not null,
  quantity numeric(15,3) default 0,
  avg_cost numeric(15,2) default 0,
  updated_at timestamptz default now()
);

-- ============================================================
-- INVENTORY MOVEMENTS - KARDEX (never delete)
-- ============================================================
create table inventory_movements (
  id uuid primary key default uuid_generate_v4(),
  material_id uuid references materials(id) not null,
  type text not null check (type in (
    'purchase', 'sale', 'adjustment_loss', 'adjustment_gain',
    'adjustment_correction', 'conversion_in', 'conversion_out', 'shrinkage'
  )),
  quantity numeric(15,3) not null, -- positive = in, negative = out
  cost_per_unit numeric(15,2),
  balance_after numeric(15,3),
  reference_id uuid,
  reference_type text,
  reason text,
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- INVENTORY ADJUSTMENTS
-- ============================================================
create table inventory_adjustments (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('loss', 'gain', 'correction', 'conversion', 'shrinkage')),
  material_id uuid references materials(id),
  quantity numeric(15,3) not null,
  reason text not null,
  notes text,
  user_id uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- SALES
-- ============================================================
create table sales (
  id uuid primary key default uuid_generate_v4(),
  customer_name text,
  operator_id uuid references profiles(id),
  cash_register_id uuid references cash_registers(id),
  total numeric(15,2) not null,
  date timestamptz default now(),
  notes text,
  status text default 'active' check (status in ('active', 'reversed')),
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- ============================================================
-- SALE ITEMS
-- ============================================================
create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id) not null,
  material_id uuid references materials(id) not null,
  quantity numeric(15,3) not null,
  price_per_unit numeric(15,2) not null,
  total numeric(15,2) not null
);

-- ============================================================
-- EXPENSES
-- ============================================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('salary', 'transport', 'supplies', 'maintenance', 'other')),
  description text not null,
  amount numeric(15,2) not null,
  cash_register_id uuid references cash_registers(id),
  user_id uuid references profiles(id),
  date timestamptz default now(),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table materials enable row level security;
alter table cash_registers enable row level security;
alter table cash_movements enable row level security;
alter table providers enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table inventory enable row level security;
alter table inventory_movements enable row level security;
alter table inventory_adjustments enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table expenses enable row level security;

-- Basic RLS: authenticated users can do everything
create policy "authenticated_all" on profiles for all to authenticated using (true) with check (true);
create policy "authenticated_all" on materials for all to authenticated using (true) with check (true);
create policy "authenticated_all" on cash_registers for all to authenticated using (true) with check (true);
create policy "authenticated_all" on cash_movements for all to authenticated using (true) with check (true);
create policy "authenticated_all" on providers for all to authenticated using (true) with check (true);
create policy "authenticated_all" on purchases for all to authenticated using (true) with check (true);
create policy "authenticated_all" on purchase_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on inventory for all to authenticated using (true) with check (true);
create policy "authenticated_all" on inventory_movements for all to authenticated using (true) with check (true);
create policy "authenticated_all" on inventory_adjustments for all to authenticated using (true) with check (true);
create policy "authenticated_all" on sales for all to authenticated using (true) with check (true);
create policy "authenticated_all" on sale_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on expenses for all to authenticated using (true) with check (true);

-- ============================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================

-- Function: create profile on new user signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (NEW.id, coalesce(NEW.raw_user_meta_data->>'name', NEW.email), 'operator');
  return NEW;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Function: update inventory on purchase item insert
create or replace function process_purchase_item()
returns trigger as $$
declare
  current_qty numeric;
  current_avg_cost numeric;
  new_avg_cost numeric;
begin
  -- Get or create inventory record
  insert into inventory (material_id, quantity, avg_cost)
  values (NEW.material_id, 0, 0)
  on conflict (material_id) do nothing;

  select quantity, avg_cost into current_qty, current_avg_cost
  from inventory where material_id = NEW.material_id;

  -- Calculate new weighted average cost
  if current_qty + NEW.quantity > 0 then
    new_avg_cost := (current_qty * current_avg_cost + NEW.quantity * NEW.price_per_unit)
                    / (current_qty + NEW.quantity);
  else
    new_avg_cost := NEW.price_per_unit;
  end if;

  -- Update inventory
  update inventory
  set quantity   = quantity + NEW.quantity,
      avg_cost   = new_avg_cost,
      updated_at = now()
  where material_id = NEW.material_id;

  -- Record kardex movement
  insert into inventory_movements
    (material_id, type, quantity, cost_per_unit, balance_after, reference_id, reference_type)
  values
    (NEW.material_id, 'purchase', NEW.quantity, NEW.price_per_unit,
     current_qty + NEW.quantity, NEW.purchase_id, 'purchase');

  return NEW;
end;
$$ language plpgsql;

create trigger on_purchase_item_insert
  after insert on purchase_items
  for each row execute function process_purchase_item();

-- Function: update inventory on sale item insert
create or replace function process_sale_item()
returns trigger as $$
declare
  current_qty     numeric;
  current_avg_cost numeric;
begin
  select quantity, avg_cost into current_qty, current_avg_cost
  from inventory where material_id = NEW.material_id;

  if current_qty is null then current_qty := 0; end if;
  if current_avg_cost is null then current_avg_cost := 0; end if;

  -- Update inventory (decrease)
  update inventory
  set quantity   = quantity - NEW.quantity,
      updated_at = now()
  where material_id = NEW.material_id;

  -- Record kardex
  insert into inventory_movements
    (material_id, type, quantity, cost_per_unit, balance_after, reference_id, reference_type)
  values
    (NEW.material_id, 'sale', -NEW.quantity, current_avg_cost,
     current_qty - NEW.quantity, NEW.sale_id, 'sale');

  return NEW;
end;
$$ language plpgsql;

create trigger on_sale_item_insert
  after insert on sale_items
  for each row execute function process_sale_item();

-- Function: update cash register balance
create or replace function update_cash_balance()
returns trigger as $$
begin
  if NEW.type in ('income', 'transfer_in') then
    update cash_registers set balance = balance + NEW.amount where id = NEW.cash_register_id;
  elsif NEW.type in ('expense', 'transfer_out') then
    update cash_registers set balance = balance - NEW.amount where id = NEW.cash_register_id;
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger on_cash_movement_insert
  after insert on cash_movements
  for each row execute function update_cash_balance();

-- ============================================================
-- INITIAL SEED DATA (optional - uncomment to use)
-- ============================================================
-- INSERT INTO materials (name, description, unit) VALUES
--   ('Cartón', 'Cartón corrugado y cajas', 'kg'),
--   ('Papel', 'Papel periódico, revistas, archivo', 'kg'),
--   ('Plástico PET', 'Botellas plásticas transparentes', 'kg'),
--   ('Plástico HDPE', 'Envases plásticos opacos', 'kg'),
--   ('Cobre', 'Cable de cobre y piezas de cobre', 'kg'),
--   ('Aluminio', 'Latas y perfiles de aluminio', 'kg'),
--   ('Hierro', 'Chatarra ferrosa', 'kg'),
--   ('Vidrio', 'Botellas y frascos de vidrio', 'kg');
