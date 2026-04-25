import os
import subprocess
import sys
from pathlib import Path

def print_step(title):
    print(f"\n{'='*50}\n-> {title}\n{'='*50}")

def main():
    root_dir = Path(__file__).resolve().parent.parent
    web_dir = root_dir / "web"
    
    sys.path.insert(0, str(root_dir / "src"))
    from gurpsai.__version__ import __version__
    
    print_step(f"Building GURPS Assistant v{__version__}")
    
    print_step("Installing PyInstaller")
    subprocess.run([sys.executable, "-m", "pip", "install", "pyinstaller"], check=True)

    print_step("Compiling React Frontend (npm run build)")
    # shell=True gives access to npm in windows nicely
    subprocess.run("npm run build", cwd=str(web_dir), shell=True, check=True)

    print_step("Bundling via PyInstaller")
    launcher_path = root_dir / "src" / "gurpsai" / "launcher.py"
    
    add_data_args = [
        "--add-data", f"{web_dir / 'dist'};web/dist",
        "--add-data", f"{root_dir / 'SYSTEM.md'};.",
        "--add-data", f"{root_dir / 'master_philosophy.md'};.",
        "--add-data", f"{root_dir / '.planning'};.planning",
        "--add-data", f"{root_dir / '.agents'};.agents",
        "--add-data", f"{root_dir / 'AGENTS.md'};.",
    ]
    
    pyinstaller_cmd = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm",
        "--name", "GURPS Assistant",
        "--onedir",          # Creates a folder with the executable and DLLs to avoid AV flags
    ] + add_data_args + [
        str(launcher_path)
    ]
    
    subprocess.run(pyinstaller_cmd, cwd=str(root_dir), check=True)
    
    print_step("Build Complete!")
    print(f"You can find the completed Build folder here: {root_dir / 'dist' / 'GURPS Assistant'}")
    
    print_step("Building Installer via Inno Setup (if available)")
    # We pass the version explicitly to the compiler
    iscc_cmd = [
        "iscc",
        f"/DMyAppVersion={__version__}",
        str(root_dir / "scripts" / "installer.iss")
    ]
    try:
        subprocess.run(iscc_cmd, cwd=str(root_dir), check=True)
        print_step("Installer Build Complete!")
    except FileNotFoundError:
        print("Inno Setup Compiler (iscc) not found in PATH. Skipping installer generation.")
    except subprocess.CalledProcessError as e:
        print(f"Inno Setup Compiler failed: {e}")

if __name__ == "__main__":
    main()
