output "site_bucket_name" {
  description = "Private S3 bucket receiving the built site."
  value       = aws_s3_bucket.site.id
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution invalidated after each deployment."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN used by IAM policies."
  value       = aws_cloudfront_distribution.site.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront domain targeted by externally managed DNS."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cloudfront_hosted_zone_id" {
  description = "CloudFront hosted zone ID for an external Route53 alias record."
  value       = aws_cloudfront_distribution.site.hosted_zone_id
}
