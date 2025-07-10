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
        "pydantic>=2.11.7",
        "email-validator>=2.1.0",  # Required for Pydantic email validation
        "argon2-cffi>=23.1.0",  # Password hashing
        "python-jose[cryptography]>=3.3.0",  # JWT handling
        "python-multipart>=0.0.6",  # Form data parsing
        "jinja2>=3.1.2",  # Template engine for frontend
        "httpx>=0.27.0",  
    ],
    extras_require={
        "dev": [
            "pycodestyle>=2.11.1",  # PEP 8 style guide checker
            "pylint>=3.0.3",  # Python linter
            "black>=24.1.1",  # Code formatter
            "mypy>=1.16.0",  # Static type checker
            "pytest>=8.0.0",  # Testing framework
            "pytest-cov>=4.1.0",  # Coverage reporting
            "pre-commit>=4.2.0",  # Git hooks manager
        ],
    },
    author="FirstDataUnion",
    author_email="evenoli@hotmail.co.uk",
    description="A local API server for the Fidu desktop application",
    python_requires=">=3.8",
)
