from setuptools import setup, find_packages

setup(
    name="fidu-core",
    version="0.1.0",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    install_requires=[
        "fastapi>=0.104.1",
        "uvicorn>=0.24.0",
        "python-dotenv>=1.0.0",
        "pydantic>=2.4.2",
    ],
    author="FirstDataUnion",
    author_email="evenoli@hotmail.co.uk",
    description="A local API server for the Fidu desktop application",
    python_requires=">=3.8",
)