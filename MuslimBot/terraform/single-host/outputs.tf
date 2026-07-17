###############################################################################
# outputs.tf — MuslimBot single-host deployment
###############################################################################

output "instance_public_ip" {
  description = "Public IPv4 address of the MuslimBot Compose host (Traefik / LiveKit edge)."
  value       = google_compute_address.host.address
}

output "vpc_id" {
  description = "Self-link / ID of the custom VPC network."
  value       = google_compute_network.vpc.id
}

output "data_disk_attached" {
  description = "True when the data disk is attached to the host instance."
  value = contains(
    google_compute_disk.data.users,
    google_compute_instance.host.self_link
  )
}

output "instance_name" {
  description = "Compute Engine instance name."
  value       = google_compute_instance.host.name
}

output "instance_self_link" {
  description = "Full self-link of the Compute Engine instance."
  value       = google_compute_instance.host.self_link
}

output "data_disk_name" {
  description = "Name of the attached application data disk."
  value       = google_compute_disk.data.name
}

output "data_disk_device_name" {
  description = "Guest device name (resolves as /dev/disk/by-id/google-<name>)."
  value       = var.data_disk_device_name
}

output "data_mount_point" {
  description = "Host path where the data disk is mounted by the startup script."
  value       = var.data_mount_point
}

output "zone" {
  description = "GCP zone of the host and data disk."
  value       = var.zone
}

output "service_account_email" {
  description = "Service account email attached to the host (Secret Manager accessor)."
  value       = google_service_account.host.email
}
