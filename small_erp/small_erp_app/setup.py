from setuptools import setup, find_packages

setup(
    name="small_erp",
    version="1.0.0",
    packages=find_packages(),
    zip_safe=False,
    include_package_data=True,
    install_requires=[
        "frappe",
        "pypdf",
        "openpyxl",
        "pandas",
        "requests",
    ],
)
