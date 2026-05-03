# History Pengembangan POS Pusat

## 2026-05-02

### Konteks Proyek
- Aplikasi dibangun sebagai dashboard pusat POS untuk minimarket sekaligus grosir dengan model pusat dan cabang.
- Pusat berfungsi sebagai dashboard owner dan gudang utama, bukan tempat penjualan.
- Sumber data MySQL lokal lama sudah dimatikan untuk dashboard simulasi. Semua cabang saat ini memakai dummy data internal dari aplikasi.
- Simulasi memakai 10 cabang aktif, termasuk cabang utama yang disebutkan user:
  - Bintang Kembar Pekanbaru
  - Bintang Kembar Dhamasraya
  - Bintang Kembar Payakumbuh
  - Bintang Kembar Tanjung Pati
  - Bintang Kembar Solok Selatan

### Progres Utama yang Sudah Dibangun
- Dashboard pusat berisi ringkasan global 10 cabang:
  - omzet hari ini
  - omzet bulan ini
  - total transaksi
  - warning expired
  - piutang
  - hutang supplier
- Dashboard pusat memakai grafik berwarna per cabang:
  - pendapatan per cabang
  - komposisi pendapatan cabang
  - pendapatan per minggu
  - ranking cabang
  - warning stok dan expired
- Grafik pendapatan per cabang dibuat full width.
- Chart pendapatan per cabang sudah memiliki tooltip hover yang menampilkan detail penjualan, namun posisi tooltip sempat perlu dikecilkan/diturunkan agar tidak terpotong.
- Header chart pendapatan per cabang sudah diminta untuk memiliki kontrol timeframe:
  - mingguan
  - bulanan
  - tahunan
  - rentang tanggal spesifik

### Halaman Cabang
- Halaman cabang dibuat terpisah dari dashboard pusat.
- Halaman cabang dipakai untuk melihat data per cabang.
- Ditambahkan komponen visual:
  - grafik pendapatan per cabang
  - produk terlaris per cabang
  - resume stok barang
  - warning stok dan expired
- Tampilan cabang memakai warna identitas cabang yang konsisten dengan dashboard.
- Ditambahkan fitur pencarian/filter berdasarkan nama dan kategori.
- Halaman cabang disiapkan sebagai area kelola cabang untuk fitur seperti tambah/edit stok dan transfer barang, masih simulasi UI.

### Halaman Penjualan
- Halaman penjualan dibuat sebagai dashboard penjualan dengan gaya kartu KPI berwarna.
- Data dummy transaksi ditambah:
  - 100 data item random per cabang
  - 100 transaksi random per cabang
  - kategori produk dibagi ke Minyak & Obat, Fashion, Elektronik, Rumah Tangga, Makanan, dan Lainnya.
- Halaman penjualan memiliki filter:
  - pilih cabang
  - pencarian nama barang/faktur/pelanggan/cabang
  - filter kategori
  - preset cepat kategori
- Data penjualan hanya tampil setelah filter/pencarian dipakai.
- Tabel resume data penjualan dibuat 25 data per halaman.
- Ditambahkan export dan cetak pada panel hasil pencarian.
- Bagian analitik penjualan sudah menampilkan:
  - total penjualan
  - produk terlaris
  - barang tidak laku
  - barang expired
  - penjualan barang terlaris, maksimal 5 item
  - barang tidak laku, maksimal 5 item
  - penjualan per kategori
  - status data penjualan
  - resume data penjualan
  - barang expire
- Tampilan filter penjualan sudah dirapikan:
  - panel filter cabang di kiri
  - panel hasil pencarian dan search bar di kanan
  - ringkasan hasil ditampilkan di bawah search bar

### Halaman Stok
- Halaman stok dibuat untuk melihat stok berdasarkan item atau cabang.
- Ditambahkan filter:
  - cabang
  - status stok
  - tampilan item/cabang
  - nama/kode barang
  - kategori
- Daftar stok tidak tampil default.
- Data stok hanya tampil setelah filter atau pencarian digunakan.
- Tabel stok dibuat 50 data per halaman.
- Tampilan stok sudah dirapikan dengan warna cabang dan icon.

### Dummy Data
- Semua sumber cabang sudah dibuat dummy internal.
- Data dummy tiap cabang dibuat berbeda.
- Data dummy meliputi:
  - branch summary
  - transaksi penjualan
  - stok limit
  - stok aman/top stock
  - barang expired/mendekati expired
  - produk terlaris
  - status transaksi
  - metode pembayaran
  - estimasi laba
- Keputusan penting: dashboard tidak lagi membaca database lokal MySQL untuk mode simulasi saat ini.

### Error dan Perbaikan yang Pernah Dicatat
- Pernah muncul error React key duplikat di halaman stok:
  - key lama memakai kombinasi `branchName-code-name/expiredAt`
  - masalah terjadi karena data dummy bisa memiliki produk sama berulang.
- Pernah muncul error React key duplikat di halaman cabang:
  - key lama memakai `code-name`
  - perlu memakai key yang lebih unik, misalnya gabungan cabang/kode/index/status/expiredAt.
- Catatan kehati-hatian: setiap list hasil dummy yang bisa berisi produk berulang harus memakai key unik yang stabil.

### Progres Terbaru: Menu Pencarian AI
- User meminta menu baru "Pencarian AI" di sidebar.
- Tujuan menu:
  - membuka halaman pencarian dengan search bar seperti Google
  - user memasukkan prompt bebas
  - sistem mencari data di database/dummy data dan menampilkan hasilnya
- Perubahan yang sudah dilakukan sebelum proses dihentikan:
  - `app/page.tsx`
    - import icon `Bot`
    - menu `Pencarian AI` ditambahkan ke sidebar dashboard.
  - `app/penjualan/page.tsx`
    - import icon `Bot`
    - menu `Pencarian AI` ditambahkan ke sidebar penjualan.
  - `app/stok/page.tsx`
    - import icon `Bot`
    - menu `Pencarian AI` ditambahkan ke sidebar stok.
  - `app/cabang/page.tsx`
    - import icon `Bot`
    - menu `Pencarian AI` ditambahkan ke sidebar cabang.
  - `app/pencarian-ai/page.tsx`
    - file halaman baru sudah dibuat.
    - halaman memakai search bar besar.
    - query memakai parameter `q`.
    - hasil pencarian membaca `getDashboardData()`.
    - pencarian mencakup transaksi, cabang, stok, dan expired.
    - halaman menampilkan ringkasan AI simulasi, transaksi, cabang, stok barang, dan expired.
  - `app/globals.css`
    - style awal untuk halaman AI sudah ditambahkan:
      - `.ai-page`
      - `.ai-hero`
      - `.ai-search-panel`
      - `.ai-search-form`
      - `.ai-search-input`
      - `.ai-search-button`
      - `.ai-suggestions`
      - `.ai-answer`
      - `.ai-result-grid`
      - `.ai-result-card`
      - `.ai-result-list`
      - `.ai-result-row`

### Catatan Penting untuk Lanjutan
- Fitur Pencarian AI masih perlu divalidasi karena proses terakhir terinterupsi sebelum lint/typecheck/build dijalankan.
- Perlu cek apakah style AI di `app/globals.css` posisinya sudah rapi dan tidak mengganggu style global lain.
- Perlu jalankan:
  - `npm exec -- eslint .`
  - `npm exec -- tsc --noEmit`
  - `npm run build`
- Perlu restart dev server setelah validasi jika ingin melihat di browser.
- Pencarian AI saat ini masih "simulasi AI" berbasis pencocokan kata pada dummy data, belum memakai LLM/API eksternal dan belum SQL agent sungguhan.
- Saat nanti database real dipakai kembali, Pencarian AI sebaiknya tidak langsung menjalankan SQL bebas dari prompt user. Gunakan intent parser/allowlist query agar aman dari query berbahaya dan kebocoran data.

### Update 2026-05-03: Penyederhanaan Halaman Pencarian AI
- User meminta data pada halaman Pencarian AI hanya ditampilkan sebagai hasil pencarian AI.
- Halaman `app/pencarian-ai/page.tsx` diperbarui:
  - panel hasil terpisah untuk Transaksi, Cabang, Stok, dan Expired dihapus.
  - hasil dari semua jenis data digabung menjadi satu daftar `Hasil Pencarian AI`.
  - data tidak tampil sebelum user memasukkan prompt.
  - setiap hasil diberi badge tipe data: Transaksi, Cabang, Stok, atau Expired.
- Style `app/globals.css` ditambah untuk:
  - `.ai-results-panel`
  - `.ai-result-list--single`
  - `.ai-result-badge`
  - variasi badge cabang/stok/expired
  - `.ai-empty`
- Validasi sudah dijalankan:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.
- Catatan error: pemanggilan `npm exec` biasa di PowerShell sempat gagal karena `npm.ps1` diblokir execution policy Windows. Solusi yang dipakai adalah `npm.cmd`.

### Update 2026-05-03: Pencarian AI Hanya Menampilkan Hasil AI
- User meminta bagian data terpisah di halaman Pencarian AI dihilangkan.
- `app/pencarian-ai/page.tsx` disederhanakan:
  - tidak ada lagi panel terpisah Transaksi/Cabang/Stok/Expired.
  - semua hasil digabung ke satu panel `Hasil Pencarian AI`.
  - daftar hasil memakai badge tipe data agar tetap mudah dipahami.
  - halaman tidak menampilkan data apapun sebelum prompt dimasukkan.
- `app/globals.css` ditambah/dirapikan untuk tampilan daftar hasil AI tunggal.
- Validasi:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.
  - `npm.cmd run build` berhasil setelah dijalankan di luar sandbox karena build pertama gagal `spawn EPERM`.
- Catatan kemungkinan error:
  - HTTP check ke dev server sempat mendapat 500 dengan pesan `__webpack_modules__[moduleId] is not a function`.
  - Build production sukses, jadi kemungkinan besar ini cache/dev server Next yang stale setelah build.
  - Port 3000 sedang dipakai proses `node` PID 23192, tetapi proses belum dimatikan otomatis karena perlu memastikan itu benar dev server proyek ini agar tidak menghentikan service lain.

### Update 2026-05-03: CSS Halaman Pencarian AI Tidak Termuat
- User mengirim screenshot halaman `/pencarian-ai` yang tampil polos tanpa CSS.
- Penyebab yang ditemukan:
  - HTML meminta stylesheet `/_next/static/css/app/layout.css?...`.
  - Endpoint CSS tersebut mengembalikan `404 Not Found`.
  - Di folder `.next/static/css` hanya ada file CSS hash production `17e76d6fc6372d81.css`.
  - Ini kemungkinan akibat dev server Next bercampur dengan hasil `next build`, sehingga referensi CSS dev menjadi stale.
- Perbaikan sementara yang dilakukan:
  - membuat folder `.next/static/css/app`.
  - menyalin `.next/static/css/17e76d6fc6372d81.css` menjadi `.next/static/css/app/layout.css`.
  - endpoint CSS kembali `200 OK`.
  - screenshot ulang menunjukkan tampilan Pencarian AI sudah kembali memakai layout/sidebar/card yang benar.
- Catatan:
  - Ini memperbaiki kondisi dev server saat ini.
  - Perbaikan paling bersih jika masalah muncul lagi adalah restart dev server dan regenerasi `.next`.

### Update 2026-05-03: Rasio Grafik Timeframe Dashboard
- User meminta grafik `Pendapatan Per Cabang` berubah sesuai angka dan tidak memakai rasio seragam antar timeframe.
- `app/page.tsx` diperbarui:
  - menambahkan helper `seededRatio()`.
  - mengganti multiplier timeframe tunggal menjadi `timeframeScale` + faktor acak deterministik per cabang dan timeframe.
  - `chartSales`, `chartTodaySales`, dan `chartTransactions` sekarang dihitung dari kombinasi:
    - data cabang asli
    - skala timeframe
    - faktor cabang/timeframe deterministik.
  - tinggi bar tetap memakai `branch.chartSales / maxMonthSales`, sehingga angka rupiah dan tinggi grafik selalu sinkron.
- Hasil cek server:
  - Mingguan, bulanan, tahunan, dan rentang tanggal menghasilkan pola nilai berbeda, bukan sekadar rasio seragam.
- Validasi:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.

### Update 2026-05-03: Timeframe Dashboard Tanpa Refresh Halaman
- User melihat bahwa klik timeframe Mingguan/Bulanan/Tahunan/Rentang membuat seluruh halaman refresh/blinking.
- Penyebab:
  - kontrol timeframe di `app/page.tsx` memakai `Link` ke `/?timeframe=...`, sehingga Next melakukan navigasi halaman.
- Perubahan:
  - membuat komponen client baru `app/components/DashboardRevenueClient.tsx`.
  - blok `Pendapatan Per Cabang`, `Komposisi Pendapatan Cabang`, `Pendapatan Per Minggu`, `Ranking Cabang`, dan `Warning Stok dan Expired` dipindah ke komponen client.
  - kontrol timeframe sekarang memakai state React (`useState`) dan tombol, bukan link URL.
  - pilihan ranking Pendapatan/Item Terjual juga memakai state lokal agar tidak reload.
  - date range memakai submit client-side dengan `event.preventDefault()`.
  - tinggi bar chart tetap sinkron dengan nilai `chartSales`.
  - CSS ditambah transisi untuk tinggi bar dan tombol segmented agar perubahan terlihat smooth.
- Validasi:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.
  - `npm.cmd run build` berhasil.
- Catatan dev server:
  - setelah `next build`, dev server port 3000 sempat error cache `.next` (`Cannot find module './611.js'`).
  - proses node di port 3000 dihentikan dan dev server dijalankan ulang.
  - `http://localhost:3000/?timeframe=bulanan` kembali `200 OK`.

### Update 2026-05-03: Ranking Timeframe dan Warning Stok Full Width
- User meminta:
  - teks `Timeframe: ...` di header `Pendapatan Per Cabang` dihapus.
  - kontrol timeframe juga ditambahkan di header `Ranking Cabang`.
  - panel `Warning Stok dan Expired` dibuat full width dan menampilkan data total serta data per cabang.
- Perubahan:
  - `app/components/DashboardRevenueClient.tsx`
    - teks timeframe di bawah judul chart pendapatan dihapus.
    - kontrol timeframe diekstrak menjadi `TimeframeControls`.
    - `Ranking Cabang` sekarang memiliki kontrol timeframe yang sama dengan chart pendapatan.
    - `Warning Stok dan Expired` menjadi `panel--full-width`.
    - warning stok menampilkan ringkasan total semua cabang dan kartu per cabang berwarna sesuai warna cabang.
    - kartu per cabang menampilkan stok aman, limit, kosong, dan expired dengan icon.
  - `app/globals.css`
    - menambahkan style `ranking-toolbar`.
    - menambahkan layout dan style `stock-warning-*`.
- Validasi:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.
  - HTTP check `http://localhost:3000/?ranking=item` berhasil `200 OK`.
- Catatan build:
  - `npm.cmd run build` gagal pada prerender `/404` dengan `Cannot find module for page: /_document`.
  - Ini kemungkinan akibat cache `.next` dev/build yang korup setelah beberapa kali build dan restart.
  - Perbaikan bersih membutuhkan regenerasi `.next`, tetapi penghapusan folder lokal perlu konfirmasi eksplisit karena termasuk delete data lokal.

### Update 2026-05-03: Internal Server Error Dashboard
- User melaporkan `Internal Server Error` pada `http://localhost:3000/?ranking=item`.
- Log `dev-server.log` menunjukkan:
  - `ENOENT: no such file or directory, open 'D:\docs\New project 3\.next\prerender-manifest.json'`.
- Tindakan:
  - proses node di port 3000 PID 17704 dihentikan.
  - dev server dijalankan ulang dengan `npm.cmd run dev -- -p 3000`.
- Hasil:
  - `http://localhost:3000/?ranking=item` kembali `200 OK`.
  - log menunjukkan halaman `/` compiled normal.
  - cek konten memastikan panel `Warning Stok dan Expired` tampil dan teks `Timeframe:` sudah hilang.

### Update 2026-05-03: Opsi Rentang Grafik Pendapatan
- User meminta grafik `Pendapatan Per Minggu` menjadi grafik pendapatan dengan opsi rentang waktu minggu, bulan, tahun.
- Perubahan di `app/components/DashboardRevenueClient.tsx`:
  - menambahkan state `trendRange`.
  - judul grafik berubah sesuai opsi:
    - `Pendapatan Per Minggu`
    - `Pendapatan Per Bulan`
    - `Pendapatan Per Tahun`
  - menambahkan segmented control `Minggu`, `Bulan`, `Tahun` pada header grafik.
  - data line chart berubah lokal/client-side tanpa reload halaman.
- Validasi:
  - `npm.cmd exec -- tsc --noEmit` berhasil.
  - `npm.cmd exec -- eslint .` berhasil.
  - HTTP check dashboard `200 OK` dan opsi trend terdeteksi.
