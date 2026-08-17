locals {
  cloudfront_origin_id = "s3-${var.site_bucket_name}"
  policy_name_prefix   = "solti-site-${replace(var.domain_name, ".", "-")}"

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
    Project     = "solti-site"
    Repository  = "soltiHQ/site"
  }
}
