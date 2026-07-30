INSERT INTO master_products (kode_produk) VALUES
('PEBJ3 - Cikarang'),
('PENT1 - Cikarang'),
('PEBK1 - Cikarang'),
('PEMA2 - Cikarang'),
('PEGA2 - Cikarang'),
('PEGM1 - Cikarang'),
('PEOM1 - Cikarang'),
('PFSK1 - Cikarang'),
('PBSJ1 - Cikarang'),
('LEXU1 - Cikarang'),
('WEGM1 - Cikarang'),
('WEMA2 - Cikarang'),
('WEBJ3 - Cikarang'),
('PEGM1 - SAF'),
('PEMA2 - SAF')
ON CONFLICT (kode_produk) DO NOTHING;