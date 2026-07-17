###############################################################################
# main.tf — MuslimBot single-host GCE environment
#
# Provisions one all-in-one VM for the full Docker Compose Business OS
# (ERPNext, Chatwoot, LiveKit voice, Traefik/Authentik, TryPost, etc.).
#
# Sizing defaults (Full profile):
#   e2-standard-8 = 8 vCPU / 32 GB RAM
#   Why: the Compose stack's steady-state footprint is ~14–15 GB
#     Core App ~4.5 + Support ~3.3 + Voice ~2.1 + Platform ~1.6 + Social ~1.2.
#   32 GB leaves headroom for the kernel page cache, docker build layers,
#   and transient spikes so MariaDB / Redis never land in swap.
#   8 vCPUs keep Rails (Chatwoot), the Go orchestrator, LiveKit media, and
#   n8n queues from starving each other under concurrent load.
#
# Low / MVP profile (override via -var or *.tfvars):
#   machine_type   = "e2-standard-4"
#   data_disk_type = "pd-balanced"
#   Set hard Docker memory limits on non-essential workers so MariaDB and
#   the Go orchestrator stay protected under the tighter 16 GB envelope.
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment after creating the state bucket for team/CI applies:
  # backend "gcs" {
  #   bucket = "muslimbot-tf-state"
  #   prefix = "terraform/single-host"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

locals {
  resource_labels = merge(var.labels, {
    environment = var.environment
  })

  host_network_tag = "muslimbot-host"
}

# ---------------------------------------------------------------------------
# Identity — least-privilege SA for future Secret Manager bootstrapping
# ---------------------------------------------------------------------------

resource "google_service_account" "host" {
  account_id   = "muslimbot-host-sa-${var.environment}"
  display_name = "MuslimBot single-host VM (${var.environment})"
  description  = "Runtime identity for the MuslimBot Compose host; Secret Manager accessor for Phase-2 .env bootstrap."
}

resource "google_project_iam_member" "host_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.host.email}"
}

# ---------------------------------------------------------------------------
# Network — custom VPC with a single public subnet
# ---------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = "muslimbot-vpc-${var.environment}"
  auto_create_subnetworks = false
  description             = "MuslimBot single-host VPC (${var.environment})"
}

resource "google_compute_subnetwork" "public" {
  name          = "muslimbot-subnet-${var.environment}"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  description   = "Public subnet for the MuslimBot Compose host (Traefik edge + LiveKit media)."
}

resource "google_compute_address" "host" {
  name         = "muslimbot-ip-${var.environment}"
  region       = var.region
  address_type = "EXTERNAL"
  description  = "Static external IP for Traefik TLS and LiveKit WebRTC NAT (use_external_ip)."
}

# ---------------------------------------------------------------------------
# Firewall — tight ingress; LiveKit media ranges are intentional
#
# Port rationale:
#   22          SSH administration
#   80 / 443    Traefik HTTP → HTTPS redirect and TLS termination
#   7880 / 7881 LiveKit signaling (WS/HTTP) and RTC over TCP fallback
#   50000-50100 LiveKit/WebRTC RTP/UDP media (matches livekit.gcp.yaml
#               and docker-compose voice profile port mappings)
# ---------------------------------------------------------------------------

resource "google_compute_firewall" "allow_ssh" {
  name    = "muslimbot-allow-ssh-${var.environment}"
  network = google_compute_network.vpc.name

  description = "SSH to the MuslimBot host. Tighten ssh_source_ranges to VPN/IAP in production."

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [local.host_network_tag]
}

resource "google_compute_firewall" "allow_web" {
  name    = "muslimbot-allow-web-${var.environment}"
  network = google_compute_network.vpc.name

  description = "HTTP/HTTPS for Traefik edge (Let's Encrypt ACME + application TLS)."

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }

  source_ranges = var.web_source_ranges
  target_tags   = [local.host_network_tag]
}

resource "google_compute_firewall" "allow_livekit" {
  name    = "muslimbot-allow-livekit-${var.environment}"
  network = google_compute_network.vpc.name

  # Voice profile: LiveKit server + egress need these ranges reachable from
  # browsers and SIP/WebRTC peers. Do not collapse into 0–65535; keep the
  # published RTC port window aligned with configs/livekit/livekit.gcp.yaml.
  description = "LiveKit signaling (TCP 7880/7881) and WebRTC media (UDP 50000-50100)."

  allow {
    protocol = "tcp"
    ports    = ["7880", "7881"]
  }

  allow {
    protocol = "udp"
    ports    = ["50000-50100"]
  }

  source_ranges = var.web_source_ranges
  target_tags   = [local.host_network_tag]
}

# ---------------------------------------------------------------------------
# Persistent data disk — MariaDB / TryPost / Chatwoot I/O path
# ---------------------------------------------------------------------------

resource "google_compute_disk" "data" {
  name   = "muslimbot-data-${var.environment}"
  type   = var.data_disk_type
  zone   = var.zone
  size   = var.data_disk_size_gb
  labels = local.resource_labels

  description = "Dedicated data volume for Compose stateful services (MariaDB, Postgres, Redis persistence)."
}

# ---------------------------------------------------------------------------
# Compute — Ubuntu 22.04 minimal + Docker + data-disk mount
# ---------------------------------------------------------------------------

resource "google_compute_instance" "host" {
  name         = "muslimbot-host-${var.environment}"
  machine_type = var.machine_type
  zone         = var.zone
  tags         = [local.host_network_tag]
  labels       = local.resource_labels

  # e2-standard-8 (default): 8 vCPU / 32 GB — see file header for sizing rationale.
  # Override to e2-standard-4 for Low/MVP or n2-standard-8 for higher per-core throughput.
  deletion_protection = var.deletion_protection

  boot_disk {
    initialize_params {
      image  = "ubuntu-os-cloud/ubuntu-minimal-2204-lts"
      size   = var.boot_disk_size_gb
      type   = var.boot_disk_type
      labels = local.resource_labels
    }
  }

  attached_disk {
    source      = google_compute_disk.data.id
    device_name = var.data_disk_device_name
    mode        = "READ_WRITE"
  }

  network_interface {
    subnetwork = google_compute_subnetwork.public.id

    access_config {
      nat_ip = google_compute_address.host.address
    }
  }

  service_account {
    email  = google_service_account.host.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    enable-oslogin = "TRUE"
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    set -euo pipefail

    DATA_DEVICE="/dev/disk/by-id/google-${var.data_disk_device_name}"
    MOUNT_POINT="${var.data_mount_point}"

    # Wait for the attached data disk to appear (up to ~2 minutes).
    for _ in $(seq 1 60); do
      if [[ -e "$${DATA_DEVICE}" ]]; then
        break
      fi
      sleep 2
    done

    if [[ ! -e "$${DATA_DEVICE}" ]]; then
      echo "ERROR: data disk $${DATA_DEVICE} not found" >&2
      exit 1
    fi

    # Format only on first boot (no existing filesystem).
    if ! blkid "$${DATA_DEVICE}" >/dev/null 2>&1; then
      mkfs.ext4 -F -L muslimbot-data "$${DATA_DEVICE}"
    fi

    mkdir -p "$${MOUNT_POINT}"
    UUID="$(blkid -s UUID -o value "$${DATA_DEVICE}")"
    if ! grep -q "$${UUID}" /etc/fstab; then
      echo "UUID=$${UUID} $${MOUNT_POINT} ext4 discard,defaults,nofail 0 2" >> /etc/fstab
    fi
    mount -a

    mkdir -p \
      "$${MOUNT_POINT}/mariadb" \
      "$${MOUNT_POINT}/postgres" \
      "$${MOUNT_POINT}/redis" \
      "$${MOUNT_POINT}/chatwoot" \
      "$${MOUNT_POINT}/trypost" \
      "$${MOUNT_POINT}/n8n" \
      "$${MOUNT_POINT}/frappe"

    # Install Docker Engine + Compose plugin (Ubuntu).
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
      curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
    fi
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$${VERSION_CODENAME}") stable" \
      > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker

    # LiveKit / high-throughput media buffer headroom (harmless on Low profile).
    sysctl -w net.core.rmem_max=26214400
    sysctl -w net.core.wmem_max=26214400
  EOF

  allow_stopping_for_update = true

  depends_on = [
    google_project_iam_member.host_secret_accessor,
  ]
}
