###############################################################################
# variables.tf — MuslimBot single-host deployment
#
# Two sizing profiles are supported by flipping a couple of variables:
#
#   Full (default) — production / concurrent voice + support + social:
#     machine_type    = "e2-standard-8"   # 8 vCPU / 32 GB
#     data_disk_type  = "pd-ssd"          # sustained DB IOPS
#     data_disk_size_gb >= 100
#
#   Low / MVP — sandbox, staging, or throttled ops (no heavy concurrent voice):
#     machine_type    = "e2-standard-4"   # 4 vCPU / 16 GB
#     data_disk_type  = "pd-balanced"     # cost-optimized I/O
#     data_disk_size_gb >= 100
#
#   Example Low apply:
#     terraform plan \
#       -var='machine_type=e2-standard-4' \
#       -var='data_disk_type=pd-balanced'
#
#   Architectural guardrail (Low): set hard Docker memory limits on
#   non-essential workers so MariaDB and the Go orchestrator are protected
#   from memory-fragmentation spikes under the 16 GB envelope.
###############################################################################

variable "project_id" {
  description = "GCP project ID that will own all resources."
  type        = string
  # Defaulted to the active MuslimBot project so the module is apply-ready.
  # Override via -var or a *.tfvars file for other environments.
  default = "gen-lang-client-0113022969"
}

variable "region" {
  description = "GCP region. Kept in-country (India) to minimize latency for users in Bangladesh."
  type        = string
  default     = "asia-south1" # Mumbai. asia-south2 (Delhi) is the alternate.

  validation {
    condition     = contains(["asia-south1", "asia-south2"], var.region)
    error_message = "region must be asia-south1 (Mumbai) or asia-south2 (Delhi) for BD-proximity latency."
  }
}

variable "zone" {
  description = "GCP zone within the selected region for the host and its data disk."
  type        = string
  default     = "asia-south1-a"
}

variable "environment" {
  description = "Environment name used as a resource-name suffix (prod, staging, sandbox)."
  type        = string
  default     = "prod"
}

variable "machine_type" {
  description = <<-DESC
    Compute Engine machine type for the all-in-one host.

    Default e2-standard-8 (8 vCPU / 32 GB) sizing rationale: the full
    Docker Compose stack has a ~14-15 GB active footprint
    (Core 4.5 + Support 3.3 + Voice 2.1 + Platform 1.6 + Social 1.2 GB).
    Provisioning 32 GB roughly doubles that so the kernel page cache,
    `docker build` layers and transient spikes never push MariaDB/Redis
    into swap. 8 vCPUs cover Chatwoot (Rails), the Go orchestrator,
    LiveKit media and n8n queues running concurrently.

    Low / Minimum-Viable profile: set to "e2-standard-4" (4 vCPU / 16 GB)
    for sandbox/staging without the concurrent heavy voice-media pipeline.
    Pair with data_disk_type = "pd-balanced". Operators must apply Docker
    memory limits on non-essential workers to protect MariaDB and the Go
    orchestrator. For higher sustained per-core throughput, use "n2-standard-8".
  DESC
  type        = string
  default     = "e2-standard-8"

  validation {
    condition = contains([
      "e2-standard-4",
      "e2-standard-8",
      "n2-standard-8",
    ], var.machine_type)
    error_message = "machine_type must be e2-standard-4 (Low), e2-standard-8 (Full), or n2-standard-8."
  }
}

variable "boot_disk_size_gb" {
  description = "Boot disk size in GB (OS + Docker engine only; app data lives on the attached data disk)."
  type        = number
  default     = 30
}

variable "boot_disk_type" {
  description = "Boot disk type."
  type        = string
  default     = "pd-balanced"
}

variable "data_disk_size_gb" {
  description = "Size of the dedicated application/data disk (MariaDB, TryPost, Chatwoot I/O). Minimum 100 GB."
  type        = number
  default     = 100

  validation {
    condition     = var.data_disk_size_gb >= 100
    error_message = "data_disk_size_gb must be at least 100 GB to sustain heavy database I/O."
  }
}

variable "data_disk_type" {
  description = <<-DESC
    Data-disk type. Default pd-ssd for sustained database IOPS
    (MariaDB, TryPost, Chatwoot). Low / Minimum-Viable profile: set to
    "pd-balanced" to cut cost while keeping the >=100 GB capacity floor.
  DESC
  type        = string
  default     = "pd-ssd"

  validation {
    condition     = contains(["pd-ssd", "pd-balanced"], var.data_disk_type)
    error_message = "data_disk_type must be pd-ssd (Full) or pd-balanced (Low)."
  }
}

variable "data_disk_device_name" {
  description = "Stable device name used to locate the data disk at /dev/disk/by-id/google-<name>."
  type        = string
  default     = "muslimbot-data"
}

variable "data_mount_point" {
  description = "Absolute path where the data disk is mounted on the host."
  type        = string
  default     = "/opt/muslimbot/data"
}

variable "subnet_cidr" {
  description = "Primary IPv4 CIDR range for the single public subnet."
  type        = string
  default     = "10.20.0.0/24"
}

variable "ssh_source_ranges" {
  description = "CIDRs allowed to reach SSH (22). Tighten to your VPN/office range in production."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "web_source_ranges" {
  description = "CIDRs allowed to reach HTTP/HTTPS (80/443) and LiveKit media (7880/7881, 50000-50100)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "labels" {
  description = "Labels applied to billable resources."
  type        = map(string)
  default = {
    app        = "muslimbot"
    managed-by = "terraform"
    topology   = "single-host"
  }
}

variable "deletion_protection" {
  description = "Guards the instance against accidental `terraform destroy`."
  type        = bool
  default     = false
}
