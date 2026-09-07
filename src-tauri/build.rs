fn main() {
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
