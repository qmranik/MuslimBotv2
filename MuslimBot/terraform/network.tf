# VPC Network
resource "google_compute_network" "muslimbot_vpc" {
  name                    = "muslimbot-vpc-${var.environment}"
  auto_create_subnetworks = false
}

# Subnet
resource "google_compute_subnetwork" "muslimbot_subnet" {
  name          = "muslimbot-subnet-${var.environment}"
  ip_cidr_range = "10.0.1.0/24"
  network       = google_compute_network.muslimbot_vpc.id
  region        = var.region
}

# Static IP for Telephony Node (Asterisk/SIP needs static IP)
resource "google_compute_address" "telephony_static_ip" {
  name   = "telephony-static-ip-${var.environment}"
  region = var.region
}

# Static IP for Core Node (Traefik/GenUI)
resource "google_compute_address" "core_static_ip" {
  name   = "core-static-ip-${var.environment}"
  region = var.region
}

# Firewall: Allow SSH
resource "google_compute_firewall" "allow_ssh" {
  name    = "muslimbot-allow-ssh-${var.environment}"
  network = google_compute_network.muslimbot_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
  source_ranges = ["0.0.0.0/0"] # In production, restrict to corporate VPN or IAP
}

# Firewall: Allow HTTP/HTTPS (Core Node)
resource "google_compute_firewall" "allow_web" {
  name    = "muslimbot-allow-web-${var.environment}"
  network = google_compute_network.muslimbot_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
  target_tags   = ["core-node"]
  source_ranges = ["0.0.0.0/0"]
}

# Firewall: Allow SIP/RTP (Telephony Node)
resource "google_compute_firewall" "allow_telephony" {
  name    = "muslimbot-allow-telephony-${var.environment}"
  network = google_compute_network.muslimbot_vpc.name

  # SIP Signaling
  allow {
    protocol = "udp"
    ports    = ["5060", "5061"]
  }
  allow {
    protocol = "tcp"
    ports    = ["5060", "5061"]
  }

  # RTP Media (LiveKit / Asterisk)
  allow {
    protocol = "udp"
    ports    = ["10000-20000", "50000-50100"] 
  }

  target_tags   = ["telephony-node"]
  source_ranges = ["0.0.0.0/0"] # Restrict SIP signaling to Trunk IP in strict prod
}
