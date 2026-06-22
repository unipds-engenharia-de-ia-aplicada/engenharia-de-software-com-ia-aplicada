provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "nexus-apollo-data" {
  bucket = "nexus-apollo-data"
  acl    = "private"

  versioning {
    enabled = true
  }
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}