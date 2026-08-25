variable "aws_region" {
  description = "AWS region for the private S3 origin bucket."
  type        = string
  nullable    = false
}

variable "domain_name" {
  description = "Existing public domain served by CloudFront. DNS is managed outside this stack."
  type        = string
  nullable    = false
}

variable "site_bucket_name" {
  description = "Globally unique name of the private S3 origin bucket."
  type        = string
  nullable    = false
}

variable "acm_certificate_arn" {
  description = "ARN of an existing ACM certificate in us-east-1 covering domain_name."
  type        = string
  nullable    = false
}
