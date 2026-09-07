fn main() {
    write_windows_icon();

    cc::Build::new()
        .cpp(true)
        .std("c++17")
        .include("../native")
        .file("../native/torreplo_core.cpp")
        .warnings(true)
        .compile("torreplo_core");

    println!("cargo:rerun-if-changed=../native/torreplo_core.cpp");
    println!("cargo:rerun-if-changed=../native/torreplo_core.h");

    tauri_build::build();
}

fn write_windows_icon() {
    let icon_path = std::path::Path::new("icons/icon.ico");
    let icon_bytes = make_windows_icon();

    if std::fs::read(icon_path).map_or(false, |current| current == icon_bytes) {
        return;
    }

    // Tauri needs icon.ico before tauri_build generates the Windows resource.
    std::fs::create_dir_all("icons").expect("failed to create icons directory");
    std::fs::write(icon_path, icon_bytes).expect("failed to write Windows icon");
}

fn make_windows_icon() -> Vec<u8> {
    const WIDTH: usize = 16;
    const HEIGHT: usize = 16;
    const ROW_BYTES: usize = WIDTH * 4;
    const MASK_ROW_BYTES: usize = 4;

    let dib_size = 40 + ROW_BYTES * HEIGHT + MASK_ROW_BYTES * HEIGHT;
    let mut icon = Vec::with_capacity(22 + dib_size);

    icon.extend_from_slice(&[0, 0, 1, 0, 1, 0, WIDTH as u8, HEIGHT as u8, 0, 0]);
    icon.extend_from_slice(&1u16.to_le_bytes());
    icon.extend_from_slice(&32u16.to_le_bytes());
    icon.extend_from_slice(&(dib_size as u32).to_le_bytes());
    icon.extend_from_slice(&22u32.to_le_bytes());

    let mut dib = vec![0u8; dib_size];
    dib[0..4].copy_from_slice(&40u32.to_le_bytes());
    dib[4..8].copy_from_slice(&(WIDTH as i32).to_le_bytes());
    dib[8..12].copy_from_slice(&((HEIGHT * 2) as i32).to_le_bytes());
    dib[12..14].copy_from_slice(&1u16.to_le_bytes());
    dib[14..16].copy_from_slice(&32u16.to_le_bytes());
    dib[20..24].copy_from_slice(&((ROW_BYTES * HEIGHT) as u32).to_le_bytes());

    for y in 0..HEIGHT {
        for x in 0..WIDTH {
            let is_border = x == 0 || y == 0 || x == WIDTH - 1 || y == HEIGHT - 1;
            let is_t_bar = (4..=11).contains(&x) && (4..=5).contains(&y);
            let is_t_stem = (7..=8).contains(&x) && (5..=12).contains(&y);
            let pixel = if is_border || is_t_bar || is_t_stem {
                [0, 0, 0, 100]
            } else {
                [24, 80, 96, 100]
            };

            let source_y = HEIGHT - 1 - y;
            let offset = 40 + source_y * ROW_BYTES + x * 4;
            dib[offset..offset + 4].copy_from_slice(&pixel);
        }
    }

    icon.extend_from_slice(&dib);
    icon
}
