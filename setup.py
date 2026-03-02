from pathlib import Path

from setuptools import find_packages, setup

ROOT = Path(__file__).resolve().parent
README = (ROOT / "README.md").read_text(encoding="utf-8")

setup(
    name="gurpsai",
    version="0.2.0",
    description="GURPS GM Assistant CLI",
    long_description=README,
    long_description_content_type="text/markdown",
    python_requires=">=3.9",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    include_package_data=True,
    entry_points={
        "console_scripts": [
            "gurpsai=gurpsai.cli:console_main",
        ]
    },
)
