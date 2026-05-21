# Cài TFT Proxy trên Mac khác

macOS có thể báo **"TFT Proxy" is damaged** khi app **chưa được Apple notarize** (build nội bộ / gửi qua Zalo, Drive, AirDrop…). App **không hỏng** — đây là cơ chế bảo mật Gatekeeper.

## Cách 1 — Mở bằng chuột phải (nhanh nhất)

1. Mở file `.dmg`, kéo **TFT Proxy** vào **Applications**
2. **Không** double-click lần đầu
3. Vào **Applications** → **chuột phải** (hoặc Control+click) **TFT Proxy** → **Open**
4. Bấm **Open** trong hộp thoại cảnh báo
5. Lần sau mở bình thường bằng double-click

## Cách 2 — Terminal (xóa cờ quarantine)

Sau khi cài vào Applications:

```bash
xattr -cr "/Applications/TFT Proxy.app"
open -a "TFT Proxy"
```

Nếu app vẫn nằm trong Downloads:

```bash
xattr -cr ~/Downloads/TFT\ Proxy.app
open ~/Downloads/TFT\ Proxy.app
```

## Cách 3 — Cho phép trong System Settings

**System Settings** → **Privacy & Security** → cuộn xuống → **Open Anyway** (nếu có) sau khi thử mở app một lần.

## Gửi file cho đồng nghiệp

| Cách gửi | Gợi ý |
|----------|--------|
| `.zip` từ `dist-electron/` | Thường ít lỗi hơn `.dmg` |
| AirDrop / USB | Ổn, nhớ gửi kèm file này |
| Google Drive / Zalo | Hay gặp "damaged" → dùng Cách 1 hoặc 2 |

## Yêu cầu trên máy nhận

```bash
brew install mitmproxy
```

(chỉ cần một lần)

## Phân phối chính thức (không báo damaged)

Cần **Apple Developer** ($99/năm), ký app + **notarize** rồi build lại. Liên hệ team build nếu cần bản notarized.
