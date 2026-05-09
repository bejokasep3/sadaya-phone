-- ============================================================
-- CUSTOM ERP & INTERNAL POS — SUPABASE MIGRATION SCRIPT
-- Bisnis Ritel Smartphone Lelang
-- ============================================================
-- Jalankan script ini di SQL Editor Supabase Anda.
-- Pastikan Anda sudah mengaktifkan Supabase Auth sebelumnya.
-- ============================================================

-- ============================================================
-- 1. TABEL: profiles (data tambahan user / role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'Profil pengguna aplikasi (admin / sales).';

-- Trigger: otomatis buat profil saat user baru daftar di Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nama, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 2. TABEL: inventory (Master Data Barang / HP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merk TEXT NOT NULL,
  tipe TEXT NOT NULL,
  imei TEXT NOT NULL UNIQUE,
  harga_modal_lelang BIGINT NOT NULL DEFAULT 0,
  harga_wajib_setor BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'requested', 'on_hand', 'sold', 'returned')),
  sales_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  waktu_diambil TIMESTAMPTZ,
  foto_url TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.inventory IS 'Master data HP (smartphone). Status: available → requested → on_hand → sold/returned.';

-- Pastikan kolom foto_url ada (untuk upgrade dari versi lama)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='inventory' AND column_name='foto_url') THEN
        ALTER TABLE public.inventory ADD COLUMN foto_url TEXT[] DEFAULT '{}';
    END IF;
END $$;

COMMENT ON COLUMN public.inventory.harga_modal_lelang IS 'Harga beli dari lelang — RAHASIA, hanya visible untuk Admin.';
COMMENT ON COLUMN public.inventory.harga_wajib_setor IS 'Harga minimum yang wajib disetor oleh Sales ke perusahaan.';

-- Index untuk query cepat berdasarkan status & IMEI
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_imei ON public.inventory(imei);


-- ============================================================
-- 3. TABEL: transactions (Catatan penjualan HP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES public.inventory(id) ON DELETE CASCADE,
  sales_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  harga_jual_aktual BIGINT NOT NULL DEFAULT 0,
  harga_wajib_setor BIGINT NOT NULL DEFAULT 0,
  harga_modal_lelang BIGINT NOT NULL DEFAULT 0,
  hak_sales BIGINT GENERATED ALWAYS AS (harga_jual_aktual - harga_wajib_setor) STORED,
  profit_perusahaan BIGINT GENERATED ALWAYS AS (harga_wajib_setor - harga_modal_lelang) STORED,
  tipe_pembayaran TEXT NOT NULL CHECK (tipe_pembayaran IN ('cash', 'transfer')),
  status TEXT NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN ('pending_validation', 'validated')),
  -- Info pembeli (Anti-Scam COD Protocol)
  nama_pembeli TEXT NOT NULL DEFAULT '',
  no_wa_pembeli TEXT NOT NULL DEFAULT '',
  lokasi_cod TEXT DEFAULT '',
  foto_bukti_url TEXT DEFAULT '',
  -- Status keuangan
  status_setor_kas TEXT NOT NULL DEFAULT 'belum'
    CHECK (status_setor_kas IN ('belum', 'lunas')),
  status_pencairan_hak_sales TEXT NOT NULL DEFAULT 'pending'
    CHECK (status_pencairan_hak_sales IN ('pending', 'lunas', 'not_applicable')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Catatan transaksi penjualan HP oleh Sales.';

-- Pastikan kolom foto_bukti_url ada (untuk upgrade dari versi lama)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='transactions' AND column_name='foto_bukti_url') THEN
        ALTER TABLE public.transactions ADD COLUMN foto_bukti_url TEXT DEFAULT '';
    END IF;
END $$;

COMMENT ON COLUMN public.transactions.hak_sales IS 'Otomatis dihitung: harga_jual_aktual - harga_wajib_setor.';
COMMENT ON COLUMN public.transactions.profit_perusahaan IS 'Otomatis dihitung: harga_wajib_setor - harga_modal_lelang.';
COMMENT ON COLUMN public.transactions.status_setor_kas IS 'Khusus COD Cash: apakah Sales sudah menyetor uang fisik ke Admin.';
COMMENT ON COLUMN public.transactions.status_pencairan_hak_sales IS 'Khusus Transfer: apakah Admin sudah mencairkan hak margin Sales.';

CREATE INDEX IF NOT EXISTS idx_transactions_sales ON public.transactions(sales_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);


-- ============================================================
-- 4. TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_inventory ON public.inventory;
CREATE TRIGGER set_updated_at_inventory
  BEFORE UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_transactions ON public.transactions;
CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- ---------- profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Semua user auth bisa melihat profil (untuk leaderboard, dsb.)
DROP POLICY IF EXISTS "Profiles: read for authenticated" ON public.profiles;
CREATE POLICY "Profiles: read for authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- User hanya bisa update profilnya sendiri
DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
CREATE POLICY "Profiles: update own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------- inventory ----------
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Admin: FULL ACCESS ke semua kolom (termasuk harga_modal_lelang)
DROP POLICY IF EXISTS "Inventory: admin full access" ON public.inventory;
CREATE POLICY "Inventory: admin full access"
  ON public.inventory FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales: Hanya bisa SELECT (baca). CATATAN: kolom harga_modal_lelang akan di-mask di level API/View.
DROP POLICY IF EXISTS "Inventory: sales read" ON public.inventory;
CREATE POLICY "Inventory: sales read"
  ON public.inventory FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'sales')
  );

-- Sales: Bisa UPDATE hanya inventori yang terkait dirinya (status changes)
DROP POLICY IF EXISTS "Inventory: sales update own" ON public.inventory;
CREATE POLICY "Inventory: sales update own"
  ON public.inventory FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'sales')
    AND (sales_id = auth.uid() OR status = 'available')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'sales')
  );

-- ---------- transactions ----------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Admin: FULL ACCESS
DROP POLICY IF EXISTS "Transactions: admin full access" ON public.transactions;
CREATE POLICY "Transactions: admin full access"
  ON public.transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales: Bisa INSERT transaksi baru (miliknya sendiri)
DROP POLICY IF EXISTS "Transactions: sales insert own" ON public.transactions;
CREATE POLICY "Transactions: sales insert own"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    sales_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'sales')
  );

-- Sales: Bisa SELECT transaksi miliknya sendiri
DROP POLICY IF EXISTS "Transactions: sales read own" ON public.transactions;
CREATE POLICY "Transactions: sales read own"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (
    sales_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'sales')
  );


-- ============================================================
-- 6. VIEW: inventory_sales_view (Tanpa harga_modal_lelang)
-- ============================================================
-- View ini WAJIB digunakan oleh API sisi Sales agar harga modal tidak bocor.
DROP VIEW IF EXISTS public.inventory_sales_view;
CREATE OR REPLACE VIEW public.inventory_sales_view AS
SELECT
  id,
  merk,
  tipe,
  imei,
  harga_wajib_setor,
  status,
  sales_id,
  waktu_diambil,
  foto_url,
  created_at,
  updated_at
FROM public.inventory;

COMMENT ON VIEW public.inventory_sales_view IS 'View inventori tanpa kolom harga_modal_lelang — digunakan oleh front-end Sales.';


-- ============================================================
-- 7. STORAGE BUCKET POLICIES (WAJIB DIJALANKAN)
-- ============================================================
-- Jalankan query ini untuk mengizinkan insert/upload foto
-- Pastikan bucket 'bukti-transaksi' dan 'inventory-photos' sudah dibuat di menu Storage.

-- Izinkan authenticated users untuk upload file baru
DROP POLICY IF EXISTS "Authenticated users can upload objects" ON storage.objects;
CREATE POLICY "Authenticated users can upload objects" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
  bucket_id IN ('bukti-transaksi', 'inventory-photos')
);

-- Izinkan authenticated users untuk melihat/mendownload file
DROP POLICY IF EXISTS "Authenticated users can read objects" ON storage.objects;
CREATE POLICY "Authenticated users can read objects" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
  bucket_id IN ('bukti-transaksi', 'inventory-photos')
);

-- Admin bisa update / delete jika diperlukan
DROP POLICY IF EXISTS "Admin can update/delete objects" ON storage.objects;
CREATE POLICY "Admin can update/delete objects" 
ON storage.objects FOR ALL 
TO authenticated 
USING (
  bucket_id IN ('bukti-transaksi', 'inventory-photos') AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  bucket_id IN ('bukti-transaksi', 'inventory-photos') AND
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- ============================================================
-- 8. TABEL: capital_funds (Tracking Modal)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.capital_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipe TEXT NOT NULL CHECK (tipe IN ('setoran', 'penarikan')),
  jumlah BIGINT NOT NULL CHECK (jumlah > 0),
  keterangan TEXT DEFAULT '',
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.capital_funds IS 'Catatan transaksi modal (setoran/penarikan).';

-- Trigger: Auto-update updated_at
DROP TRIGGER IF EXISTS set_updated_at_capital_funds ON public.capital_funds;
CREATE TRIGGER set_updated_at_capital_funds
  BEFORE UPDATE ON public.capital_funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS: capital_funds
ALTER TABLE public.capital_funds ENABLE ROW LEVEL SECURITY;

-- Admin: FULL ACCESS
DROP POLICY IF EXISTS "Capital Funds: admin full access" ON public.capital_funds;
CREATE POLICY "Capital Funds: admin full access"
  ON public.capital_funds FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- DONE! Jalankan script ini di SQL Editor Supabase.
-- ============================================================
