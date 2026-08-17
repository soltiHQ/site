variable "aws_region" {
  description = "AWS region for the private S3 origin bucket."
  type        = string
  nullable    = false

  validation {
    condition     = length(trimspace(var.aws_region)) > 0
    error_message = "aws_region must not be empty."
  }
}

variable "domain_name" {
  description = "Existing public domain served by CloudFront. DNS is managed outside this stack."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$", var.domain_name))
    error_message = "domain_name must be a lowercase fully qualified domain name."
  }
}

variable "site_bucket_name" {
  description = "Globally unique name of the private S3 origin bucket."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$", var.site_bucket_name))
    error_message = "site_bucket_name must be a valid 3-63 character S3 bucket name."
  }
}

variable "acm_certificate_arn" {
  description = "ARN of an existing ACM certificate in us-east-1 covering domain_name."
  type        = string
  nullable    = false

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/[0-9a-f-]+$", var.acm_certificate_arn))
    error_message = "acm_certificate_arn must be an ACM certificate ARN from us-east-1."
  }
}
