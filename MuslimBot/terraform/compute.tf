# Service Account for VMs
resource "google_service_account" "muslimbot_sa" {
  account_id   = "muslimbot-vm-sa-${var.environment}"
  display_name = "MuslimBot VM Service Account"
}

resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.muslimbot_sa.email}"
}

# Core Node (Orchestrator, GenUI, ERP, n8n, DBs)
resource "google_compute_instance" "core_node" {
  name         = "muslimbot-core-${var.environment}"
  machine_type = "e2-standard-4" # 4 vCPU, 16GB RAM for all core services
  zone         = var.zone
  tags         = ["core-node"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 100
      type  = "pd-ssd"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.muslimbot_subnet.id
    access_config {
      nat_ip = google_compute_address.core_static_ip.address
    }
  }

  service_account {
    email  = google_service_account.muslimbot_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    # Startup script to install docker
    startup-script = <<-EOF
      #!/bin/bash
      apt-get update
      apt-get install -y ca-certificates curl gnupg
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
      chmod a+r /etc/apt/keyrings/docker.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
      apt-get update
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
      systemctl enable docker
      systemctl start docker
    EOF
  }
}

# Telephony Node (Asterisk, LiveKit)
resource "google_compute_instance" "telephony_node" {
  name         = "muslimbot-telephony-${var.environment}"
  machine_type = "e2-small" # Dedicated to networking/RTP traffic
  zone         = var.zone
  tags         = ["telephony-node"]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 50
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.muslimbot_subnet.id
    access_config {
      nat_ip = google_compute_address.telephony_static_ip.address
    }
  }

  service_account {
    email  = google_service_account.muslimbot_sa.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    startup-script = <<-EOF
      #!/bin/bash
      apt-get update
      apt-get install -y docker-ce docker-compose-plugin
      # Optimization for networking
      sysctl -w net.core.rmem_max=26214400
      sysctl -w net.core.wmem_max=26214400
    EOF
  }
}
