# Panduan Awal Aplikasi POS, Keuangan, dan Manajemen Barang

Tanggal: 02 Mei 2026  
Bahasa aplikasi: Bahasa Indonesia  
Format lokal: Rupiah, tanggal Indonesia, zona waktu WIB

## 1. Ringkasan Aplikasi

Aplikasi yang akan dibangun adalah sistem pusat untuk bisnis minimarket sekaligus grosir dengan struktur pusat, gudang utama, dan banyak cabang. Aplikasi ini digunakan untuk bisnis sendiri, bukan SaaS untuk banyak perusahaan.

Pada tahap akhir, sistem akan mencakup POS/kasir, manajemen produk, stok, pembelian, supplier, hutang, piutang, member, promo, laporan, audit log, approval, dan kontrol pusat-cabang.

Namun untuk target awal 1 bulan, prioritas utama adalah dashboard pusat yang terhubung ke database MySQL aplikasi lama cabang. Aplikasi lama cabang masih dipakai sementara, dan sistem baru tahap awal berfungsi sebagai pusat monitoring, laporan, serta kontrol data lintas cabang.

## 2. Struktur Bisnis

- Jenis usaha: minimarket sekaligus grosir.
- Digunakan untuk bisnis sendiri.
- Jumlah cabang awal: 10 cabang.
- Cabang kemungkinan bertambah.
- Ada pusat sekaligus gudang utama.
- Pusat tidak melakukan penjualan langsung ke pelanggan.
- Produk utama sama di semua cabang, tetapi cabang boleh mengusulkan produk tambahan.
- Produk tambahan cabang harus disetujui pusat sebelum dijual.

## 3. Prioritas MVP 1 Bulan

Prioritas utama MVP adalah dashboard pusat.

Cabang masih menggunakan aplikasi lama berbasis Delphi dengan database MySQL lokal masing-masing. Dashboard pusat berjalan di VPS dan terhubung ke database cabang melalui VPN.

Target MVP:

- Dashboard pusat untuk Owner dan Admin Pusat.
- Sinkronisasi data dari database MySQL cabang ke database pusat.
- Laporan pusat lintas cabang.
- Monitor status cabang dan sinkronisasi.
- Kontrol perubahan data dari pusat ke cabang.
- Audit log perubahan pusat ke cabang.
- Fondasi sistem baru untuk menggantikan aplikasi cabang di fase berikutnya.

Status simulasi implementasi saat ini:

- Dashboard pusat sudah dibuat sebagai web app Next.js.
- Untuk pengembangan awal, dashboard mensimulasikan 10 cabang dari satu database lokal `toko_1_3`.
- Cabang yang sudah diberi nama:
  - Bintang Kembar Pekanbaru
  - Bintang Kembar Dhamasraya
  - Bintang Kembar Payakumbuh
  - Bintang Kembar Tanjung Pati
  - Bintang Kembar Solok Selatan
- Lima cabang lain masih memakai nama sementara `Bintang Kembar Cabang 06` sampai `Bintang Kembar Cabang 10`.
- Data penjualan, pembelian, hutang, dan piutang dummy memakai prefix `DMY-` pada database sample.
- Data performa tiap cabang saat ini divariasikan di layer dashboard, bukan dari 10 database berbeda.
- Halaman detail cabang tersedia di `/cabang` dan dapat memilih cabang melalui query `?kode=C01` sampai `?kode=C10`.
- Halaman `/cabang` sekarang difokuskan sebagai halaman kelola cabang: pilih cabang, tambah/edit stok, draft koreksi stok, dan draft transfer barang.
- Halaman `/penjualan` berisi resume penjualan, filter cabang, grafik produk terlaris, warning barang tidak laku, dan barang expired.
- Halaman `/stok` berisi stock barang dengan filter berdasarkan cabang, item/status, stok limit, dan mendekati expired.
- Dashboard pusat `/` difokuskan untuk ringkasan global 10 cabang, grafik pendapatan mingguan/bulanan, warning expired, dan ranking cabang berdasarkan pendapatan.

Fitur POS baru, offline mode, PWA kasir, dan penggantian aplikasi Delphi cabang masuk fase lanjutan setelah dashboard pusat stabil.

## 4. Arsitektur Data Tahap Awal

Setiap cabang memiliki database MySQL sendiri. Dashboard pusat berada di VPS dan mengambil data dari setiap database cabang melalui VPN.

Data dari cabang disalin ke database pusat untuk kebutuhan laporan. Dashboard tidak melakukan query realtime setiap laporan dibuka.

Pola sinkronisasi:

- Sinkron otomatis setiap 1 jam.
- User pusat dapat menjalankan sinkron manual.
- Data transaksi disimpan detail lengkap, termasuk item transaksi.
- Semua histori lama dari cabang perlu disinkron sejak awal.
- Karena database lama tidak memiliki kode cabang unik, sistem pusat harus memiliki master cabang sendiri dan memetakan setiap koneksi database ke cabang terkait.

Catatan teknis:

- Initial sync harus bertahap per cabang.
- Proses sinkron perlu progress, status sukses/gagal, dan kemampuan resume.
- Untuk laporan cepat, data detail tetap disimpan, tetapi ringkasan/materialized view dapat dibuat di database pusat.

## 5. Database Lama

Sample database lama:

- Host: localhost
- Username: root
- Password: kosong
- Port: 3306
- Database: toko_1_3
- Lokasi MySQL lokal: C:\Appserv\mysql
- MySQL client: C:\Appserv\mysql\bin\mysql.exe
- Status: copy/sample dari database cabang aktif
- Aplikasi lama: SID Retail PRO SP 5
- Versi terlihat di aplikasi: 6.1.2.7
- Teknologi aplikasi lama: Delphi
- Struktur database lama sama di semua cabang
- Referensi manual: https://www.software-id.com/tutorial/SID_Retail.pdf

MySQL client sudah ditemukan dan database sample berhasil dibaca dari terminal.

Tabel inti yang sudah teridentifikasi:

- Produk: `barang`
- Penjualan: `penjualan`, `itempenjualan`
- Pembelian: `pembelian`, `itempembelian`
- Supplier: `supplier`
- Pelanggan/member: `pelanggan`, `member`
- Hutang/piutang: `hutang`, `piutang`, `itemhutang`, `itempiutang`
- Kas: `kas`, `kas_awal`, `mutasikas`
- Mutasi barang: `mutasibarang`, `itemmutasi`
- Expired: `expired_barang`
- Diskon/promo: `barang_diskon`, `detail_diskon`, `voucher`
- User/kasir/karyawan: `kasir`, `karyawan`, `loginkaryawan`

## 5A. Pemahaman Aplikasi Lama SID Retail

Berdasarkan manual SID Retail Pro dari software-id.com, aplikasi lama memiliki modul utama berikut:

- Instalasi dan koneksi database MySQL. Untuk mode 1 komputer, koneksi default menggunakan hostname `localhost`, username `root`, dan password kosong.
- Master data, termasuk login user, level akses, ganti password, data barang, jasa, pelanggan/member/cabang, dan data pendukung lain.
- Data barang mendukung harga bertingkat, barcode/label, open price, barang rakitan/packing, stok minimum, stok over, stok kadaluarsa, dan kartu stok.
- Transaksi penjualan mencakup penjualan toko, penjualan partai, penjualan cabang, dan penjualan PO.
- Pada penjualan tunai, stok berkurang otomatis dan kas bertambah otomatis.
- Penjualan partai memakai harga partai dari master barang.
- Penjualan cabang memakai harga cabang dari master barang.
- Pembelian mendukung laporan per periode, supplier, barang, retur pembelian, dan penerimaan retur pembelian.
- Laporan bawaan mencakup pembelian, penjualan, stok, pengeluaran, mutasi kas, laba rugi, kas, grafik, hutang-piutang, karyawan, dan member.
- Laporan penjualan mencakup periode/omzet, pelanggan, sales, barang, counter, kategori, kartu/ATM, kasir, retur penjualan, komisi SPG, pembulatan, harian kasir tutup, serta fast/slow moving.
- Laporan stok mencakup stok barang, stok limit, stok over, stok minus, kartu stok, stok opname, dan stok kadaluarsa.
- Laporan hutang menampilkan hutang toko kepada supplier dan pembayaran hutang per periode.
- Laporan piutang menampilkan piutang pelanggan, pembayaran piutang per periode/pelanggan, dan piutang jatuh tempo.

Implikasi untuk dashboard pusat:

- Dashboard MVP sebaiknya meniru kategori laporan SID yang sudah familiar bagi user, terutama penjualan periode/omzet, penjualan barang, penjualan kasir, stok limit, stok kadaluarsa, hutang, dan piutang.
- Mapping harga perlu memperhatikan kolom `harga_toko`, `harga_partai`, `harga_cabang`, `harga_member`, dan tabel harga per group bila digunakan.
- Mapping transaksi perlu membedakan jenis penjualan toko, partai, cabang, dan PO jika kolom di database lama menunjukkan tipe tersebut.
- Perubahan dari pusat ke cabang harus mengikuti perilaku SID, karena aplikasi Delphi lama dapat menghitung stok/kas otomatis berdasarkan tabel transaksi.

Langkah berikutnya untuk analisis database:

- Aktifkan MySQL client di PATH, atau
- Gunakan path MySQL dari XAMPP/Laragon, atau
- Export database sample menjadi file `.sql` dari phpMyAdmin.

## 6. Kontrol Data Dari Pusat Ke Cabang Lama

Dashboard pusat tidak hanya read-only. Pusat dapat mengubah data tertentu di database cabang lama.

Data yang boleh diubah pusat:

- Produk
- Harga
- Promo/diskon
- Stok
- Supplier
- Pelanggan/member
- User cabang

Pola pengiriman perubahan:

- Pusat menyimpan perubahan terlebih dahulu.
- User dapat klik "kirim ke cabang".
- User dapat memilih semua cabang atau beberapa cabang tertentu.
- Jika sebagian cabang gagal, cabang yang berhasil tetap tersimpan.
- Cabang yang gagal diberi status gagal dan bisa retry.

Audit perubahan wajib mencatat:

- User pembuat perubahan
- Waktu perubahan
- Data sebelum dan sesudah
- Cabang tujuan
- Status kirim per cabang
- Error jika gagal

Catatan risiko:

- Karena aplikasi Delphi lama masih digunakan, update langsung ke database cabang harus sangat hati-hati.
- Perubahan harus mengikuti struktur dan aturan aplikasi lama.
- Perlu whitelist operasi yang boleh dilakukan.
- Perlu validasi ketat, audit log, dan backup sebelum perubahan besar.

## 7. Konfigurasi Cabang

Data konfigurasi cabang yang disimpan di pusat:

- Nama cabang
- Kode cabang
- Alamat
- Kontak
- IP/host VPN database
- Nama database
- Username/password read/write
- Status aktif
- Jadwal sinkron

Credential database cabang wajib dienkripsi di database pusat.

## 8. Monitor Status Cabang

Dashboard pusat perlu halaman monitor status cabang.

Informasi yang ditampilkan:

- Cabang online/offline
- Terakhir sinkron
- Sinkron berhasil/gagal
- Error koneksi VPN/database
- Jumlah data pending dikirim ke cabang

## 9. Laporan Dashboard Pusat MVP

Laporan wajib tahap pertama:

- Omzet harian per cabang
- Omzet bulanan per cabang
- Laba kotor
- Stok per cabang
- Produk stok kosong/minimum
- Produk terlaris
- Detail transaksi penjualan
- Pembelian
- Hutang supplier
- Piutang pelanggan

Export laporan:

- Excel
- CSV

Dashboard ringkasan Owner/Pusat:

- Omzet hari ini
- Omzet per cabang
- Laba kotor
- Stok kritis
- Piutang jatuh tempo
- Hutang jatuh tempo
- Produk terlaris
- Alert expired

Referensi gaya aplikasi: Accurate. Tampilan sebaiknya rapi, bisnis, data-heavy, banyak tabel/filter/laporan, bukan landing page atau desain marketing.

## 10. Role dan Hak Akses

Role yang dibutuhkan:

- Owner
- Admin pusat
- Admin gudang pusat
- Supervisor cabang
- Admin cabang
- Kasir
- Auditor

Aturan akses:

- User cabang hanya boleh melihat data cabangnya sendiri.
- Owner, pusat, dan auditor dapat melihat lintas cabang sesuai hak akses.
- Auditor hanya melihat laporan, audit log, stok, dan transaksi tanpa mengubah data.
- Modul keuangan dikelola oleh Owner/Admin Pusat, tidak ada role finance terpisah.

Approval:

- Approval cukup satu level.
- Aturan approver bisa berbeda berdasarkan jenis aksi.

## 11. Keamanan

Login:

- Username/password.
- PIN cepat untuk kasir.
- User pusat seperti Owner dan Admin Pusat wajib memakai 2FA.
- 2FA menggunakan Authenticator app.

Keamanan sistem:

- HTTPS wajib untuk akses dashboard pusat.
- Password harus di-hash.
- Role permission harus ketat.
- Audit log wajib lengkap.
- Rate limit login perlu tersedia.
- Credential database cabang wajib terenkripsi.
- Pembatasan IP admin pusat/owner belum diputuskan dan dapat masuk fase berikutnya.
- Backup otomatis harian.

Audit log wajib untuk:

- Login/logout
- Tambah/ubah/hapus produk
- Ubah harga
- Edit/batal transaksi
- Approval diskon
- Approval pembelian
- Penyesuaian stok
- Perubahan hak akses user
- Perubahan data dari pusat ke cabang

Catatan risiko:

- Penghapusan permanen transaksi oleh Owner diperbolehkan, tetapi secara teknis sebaiknya tetap ada audit/arsip internal agar laporan dan jejak pemeriksaan tidak rusak.

## 12. Produk dan Harga

Produk:

- Master produk utama dikelola pusat.
- Cabang boleh mengajukan produk tambahan dengan approval pusat.
- Produk mendukung satuan bertingkat, misalnya pcs, renteng, dus, karton.
- Satu produk cukup satu barcode untuk tahap awal.
- Produk mencatat expired date dan batch/lot.

Harga:

- Harga dasar ditentukan pusat.
- Cabang boleh mengubah harga dalam batas tertentu.
- Jenis harga yang didukung:
  - Harga ecer
  - Harga grosir
  - Harga member
  - Harga reseller
  - Harga promo
  - Harga khusus per cabang
- Harga grosir berdasarkan jumlah beli dan tipe pelanggan.

Modal:

- Harga modal ditentukan manual oleh admin/pusat.
- Sistem tetap disarankan menyimpan harga beli per batch sebagai histori.

Catatan kemungkinan salah:

- Karena sistem menggunakan batch, expired, dan FEFO, laporan laba paling akurat seharusnya memakai modal berdasarkan batch barang yang terjual. Pilihan modal manual lebih sederhana, tetapi laba bisa kurang akurat saat harga beli sering berubah.

## 13. Stok dan Gudang

Stok:

- Stok dikelola per cabang dan gudang pusat.
- Pusat dapat melihat stok semua cabang.
- Metode pengeluaran stok: FEFO.
- Histori mutasi stok wajib lengkap.

Peringatan:

- Stok minimum
- Stok kosong
- Barang mendekati expired
- Barang sudah expired

Mutasi stok mencakup:

- Pembelian
- Penjualan
- Transfer pusat ke cabang
- Transfer antar cabang
- Retur
- Stok opname
- Barang rusak/hilang/expired

Transfer:

- Gudang pusat dapat transfer barang ke cabang.
- Cabang dapat transfer ke cabang lain dengan approval pusat.
- Cabang dapat membuat restock request ke pusat.

Stok opname:

- Fitur stok opname diperlukan.
- Semua penyesuaian stok hasil stok opname harus approval pusat.
- Barang rusak, hilang, atau expired perlu dicatat sebagai pengurang stok dan harus approval pusat.

## 14. POS dan Penjualan Fase Lanjutan

Input barang di POS:

- Scan barcode
- Cari nama produk/SKU manual
- Pilih dari daftar kategori

Pembayaran:

- Tunai
- QRIS
- Transfer bank
- Piutang pelanggan
- Split payment

Diskon dan promo:

- Diskon per item
- Diskon total transaksi
- Voucher/kode promo
- Promo otomatis, misalnya beli 2 gratis 1
- Promo berdasarkan member
- Diskon besar atau harga khusus di luar aturan perlu approval supervisor/admin.

Retur:

- Retur penjualan diperlukan.
- Hasil retur menjadi saldo/piutang pelanggan, bukan refund uang langsung.

Transaksi selesai:

- Boleh dibatalkan dan diedit dengan approval.
- Wajib menyimpan audit log sebelum/sesudah, alasan, user, waktu, dan approver.

Offline:

- POS harus bisa transaksi offline lalu sinkron saat online.
- Saat offline hanya penjualan tunai.
- Saat offline tidak boleh diskon.

Struk:

- Printer thermal 58mm.
- Perangkat lain masih belum dipastikan.

Shift:

- Perlu buka/tutup shift kasir.
- Ada modal awal, closing, total sistem, total uang fisik, selisih, dan laporan per kasir.
- Konsep kas: satu cabang memiliki satu kas utama.

## 15. Pembelian dan Supplier

Pembelian:

- Cabang boleh membeli langsung ke supplier, tetapi harus approval pusat.
- Pembelian dapat memakai PO atau langsung dicatat saat barang datang.
- Penerimaan barang boleh sebagian/bertahap.

Pembayaran pembelian:

- Tunai
- Transfer bank
- Hutang supplier
- Tempo pembayaran dengan jatuh tempo

Supplier:

- Data supplier lengkap diperlukan.
- Data mencakup nama, kontak, alamat, NPWP, rekening bank, tempo pembayaran, dan histori pembelian.
- Cabang bisa punya supplier lokal, tetapi harus approval pusat.
- Hutang supplier dengan jatuh tempo dan status pembayaran diperlukan.

## 16. Pelanggan, Member, dan Piutang

Pelanggan/member:

- Data pelanggan/member lengkap diperlukan.
- Data mencakup nama, nomor HP, alamat, tipe pelanggan, limit piutang, poin, dan histori belanja.

Piutang:

- Piutang pelanggan dengan jatuh tempo dan status pembayaran diperlukan.
- Pelanggan yang boleh berutang wajib terdaftar dan memiliki limit piutang.

Member:

- Sistem poin member diperlukan.
- Penggunaan poin belum diputuskan.
- Pelanggan/member perlu level/tier seperti member biasa, grosir, reseller, VIP, atau pelanggan piutang.
- Setiap level member bisa punya aturan harga, diskon, dan poin berbeda.

## 17. Platform dan Teknologi

Platform utama:

- Web app.

Perangkat kasir:

- PC/laptop Windows.

Perangkat tambahan:

- Barcode scanner.
- Printer thermal 58mm.

Model deployment:

- Hybrid: server online/pusat + data lokal POS untuk offline.

Stack rekomendasi:

- Frontend: React + Next.js.
- Backend: NestJS.
- Database pusat: PostgreSQL.
- ORM: Prisma.
- Bahasa: TypeScript penuh.
- Data lokal POS offline fase lanjutan: IndexedDB atau SQLite lokal, akan ditentukan saat desain teknis POS.

## 18. Migrasi Data

Data lama berasal dari MySQL dan masih aktif dipakai.

Data yang perlu dimigrasikan:

- Produk
- Kategori
- Supplier
- Pelanggan/member
- Stok cabang/gudang
- Harga produk
- Riwayat transaksi penjualan
- Riwayat pembelian
- Hutang/piutang
- Semua data lama lain yang relevan

Pola perpindahan sistem akhir:

- Langsung pindah total di satu tanggal.
- Data lama harus tetap bisa dicari dan dipakai di sistem baru.
- Nomor invoice lama harus bisa dicari.
- Histori transaksi lama tampil di laporan.
- Piutang lama bisa dibayar di sistem baru.

Catatan risiko:

- Karena database lama masih aktif dipakai, cut-over perlu freeze window.
- Contoh proses: tutup transaksi lama pada jam tertentu, migrasi final, validasi saldo stok/kas/hutang/piutang, lalu sistem baru dibuka.

## 19. Roadmap Pengembangan

### Fase 1: Dashboard Pusat MVP

- Setup project Next.js, NestJS, PostgreSQL, Prisma.
- Master cabang dan konfigurasi koneksi database cabang.
- Enkripsi credential database cabang.
- Worker sinkronisasi data cabang ke pusat.
- Sinkron otomatis 1 jam dan sinkron manual.
- Monitor status cabang.
- Dashboard owner/admin pusat.
- Laporan omzet, stok, transaksi, pembelian, hutang, piutang.
- Export Excel dan CSV.
- Modul perubahan data pusat ke cabang dengan status kirim dan retry.
- Audit log.
- Login, role permission, dan 2FA authenticator app.

### Fase 2: Fondasi Sistem Operasional Baru

- Master produk baru.
- Master harga dan aturan harga.
- Master supplier.
- Master pelanggan/member.
- Modul stok pusat dan cabang.
- Restock request.
- Transfer pusat-cabang.
- Stok opname.
- Approval satu level.

### Fase 3: POS Baru

- POS web/PWA untuk kasir.
- Barcode scanner.
- Printer thermal 58mm.
- Tunai, QRIS, transfer, piutang.
- Split payment.
- Diskon/promo.
- Shift kasir.
- Retur.
- Offline tunai tanpa diskon.
- Sinkron transaksi offline.

### Fase 4: Cut-over dari Sistem Lama

- Migrasi final dari MySQL lama ke PostgreSQL.
- Validasi data cabang.
- Freeze transaksi lama.
- Aktivasi POS baru per tanggal cut-over.
- Monitoring pasca go-live.

### Fase 5: Penyempurnaan

- Laporan lanjutan.
- Optimasi performa.
- Materialized view/reporting warehouse.
- Poin member lengkap.
- Pembatasan IP admin bila dibutuhkan.
- Integrasi perangkat tambahan bila dibutuhkan.

## 20. Panduan Coding Awal

Prinsip utama:

- Jangan langsung menulis ke database cabang tanpa audit log dan validasi.
- Gunakan koneksi database cabang melalui VPN.
- Gunakan database user dengan hak minimum sesuai kebutuhan.
- Untuk operasi baca, gunakan credential read-only bila memungkinkan.
- Untuk operasi tulis, batasi hanya pada modul yang sudah dipetakan aman.
- Simpan semua perubahan pusat sebagai command/change request sebelum dikirim ke cabang.
- Setiap pengiriman ke cabang harus punya status per cabang.
- Jangan menganggap cabang selalu online.
- Semua proses sync harus idempotent agar aman diulang.
- Semua data cabang di database pusat harus menyimpan `branch_id`.
- Jangan mengandalkan kode cabang dari database lama karena belum ada.

Struktur modul backend awal:

- Auth
- Users
- Roles & Permissions
- Branches
- Branch Database Connections
- Sync Jobs
- Sync Logs
- Dashboard
- Reports
- Legacy Data Mapping
- Change Requests
- Change Dispatch
- Audit Logs
- Exports

Struktur modul frontend awal:

- Login + 2FA
- Layout dashboard pusat
- Dashboard ringkasan
- Monitor cabang
- Laporan penjualan
- Laporan stok
- Laporan transaksi
- Laporan pembelian
- Laporan hutang/piutang
- Master cabang
- Pengaturan koneksi database
- Perubahan data pusat ke cabang
- Audit log

## 21. Pertanyaan Teknis Lanjutan

Pertanyaan berikutnya sebaiknya fokus ke database lama:

1. Di mana lokasi executable MySQL client dari XAMPP/Laragon?
2. Apa saja nama tabel transaksi penjualan, item transaksi, produk, stok, pembelian, supplier, pelanggan, hutang, dan piutang?
3. Apakah setiap tabel memiliki primary key dan kolom tanggal update?
4. Apakah database lama menyimpan transaksi batal/edit?
5. Bagaimana struktur harga ecer/grosir/member di database lama?
6. Apakah stok dihitung dari kartu stok atau tersimpan sebagai stok akhir?
7. Apakah aplikasi lama memiliki tabel user dan hak akses?
8. Apakah aplikasi lama memiliki audit log?
9. Apakah ada trigger/stored procedure yang dipakai Delphi?
10. Apakah aplikasi lama memakai nomor invoice dengan pola tertentu?
