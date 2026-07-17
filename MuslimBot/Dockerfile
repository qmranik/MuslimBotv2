##############################################################################
# Small ERP — Custom Frappe Image
# Bakes ERPNext + small_erp custom app into a single immutable image.
#
# Build from repository root:
#   docker build -t small-erp:latest .
#
# Used by:
#   small_erp/docker-compose.yml   (production mode, no override)
#   docker-compose.yml             (SaaS multi-tenant with Traefik)
#
# Frappe double-directory convention:
#   apps/small_erp/           <- package root (setup.py lives here)
#   apps/small_erp/small_erp/ <- actual module (hooks.py, api/, www/, etc.)
##############################################################################

FROM frappe/erpnext:v15

USER root

# Create the outer package directory
RUN mkdir -p /home/frappe/frappe-bench/apps/small_erp

# Copy setup.py to the package root
COPY small_erp/small_erp_app/setup.py /home/frappe/frappe-bench/apps/small_erp/setup.py

# Copy the app source into the INNER module directory
# small_erp_app/small_erp/ has: hooks.py, api/, utils/, www/, templates/, public/, etc.
COPY small_erp/small_erp_app/small_erp /home/frappe/frappe-bench/apps/small_erp/small_erp

# Copy utility scripts into the inner module (bench execute needs them here)
COPY small_erp/finish_setup.py /home/frappe/frappe-bench/apps/small_erp/small_erp/finish_setup.py
COPY small_erp/seed_demo.py /home/frappe/frappe-bench/apps/small_erp/small_erp/seed_demo.py
COPY small_erp/seed_pharma.py /home/frappe/frappe-bench/apps/small_erp/small_erp/seed_pharma.py
COPY small_erp/seed_orgs.py /home/frappe/frappe-bench/apps/small_erp/small_erp/seed_orgs.py
COPY small_erp/small_erp_app/small_erp/setup_permissions.py /home/frappe/frappe-bench/apps/small_erp/small_erp/setup_permissions.py

# Ensure __init__.py exists at both levels
RUN touch /home/frappe/frappe-bench/apps/small_erp/__init__.py

# Fix ownership
RUN chown -R frappe:frappe /home/frappe/frappe-bench/apps/small_erp

USER frappe

WORKDIR /home/frappe/frappe-bench

# Install the app via pip (editable mode for development compatibility)
RUN ./env/bin/pip install -e /home/frappe/frappe-bench/apps/small_erp

# Register the app in apps.txt (ensure newline before appending)
RUN sed -i -e '$a\' sites/apps.txt 2>/dev/null; \
    grep -qxF 'small_erp' sites/apps.txt 2>/dev/null || echo 'small_erp' >> sites/apps.txt

# Build frontend assets (CSS, JS)
RUN bench build --app small_erp

# Copy n8n workflow configs into the image for easy import
COPY --chown=frappe:frappe small_erp/configs/n8n/ /home/frappe/frappe-bench/configs/n8n/
