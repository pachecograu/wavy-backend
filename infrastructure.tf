# WAVY Backend - Infraestructura AWS 100% Free Tier
# EC2 t2.micro + DynamoDB + S3 + Lambda + EventBridge

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS Account ID"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "wavy-backend"
}

variable "livekit_api_key" {
  description = "LiveKit API Key"
  type        = string
  sensitive   = true
}

variable "livekit_api_secret" {
  description = "LiveKit API Secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret"
  type        = string
  sensitive   = true
}

provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ============================================
# DynamoDB Tables (Free Tier: 25GB storage)
# ============================================

resource "aws_dynamodb_table" "waves" {
  name         = "wavy-waves"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "waveId"

  attribute {
    name = "waveId"
    type = "S"
  }

  tags = { Name = "wavy-waves" }
}

resource "aws_dynamodb_table" "users" {
  name         = "wavy-users"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = { Name = "wavy-users" }
}

resource "aws_dynamodb_table" "tracks" {
  name         = "wavy-tracks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "trackId"

  attribute {
    name = "trackId"
    type = "S"
  }

  attribute {
    name = "waveId"
    type = "S"
  }

  global_secondary_index {
    name            = "waveId-index"
    hash_key        = "waveId"
    projection_type = "ALL"
  }

  tags = { Name = "wavy-tracks" }
}

resource "aws_dynamodb_table" "cache" {
  name         = "${var.project_name}-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "cacheKey"

  attribute {
    name = "cacheKey"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = { Name = "${var.project_name}-cache" }
}

resource "aws_dynamodb_table" "sessions" {
  name         = "${var.project_name}-sessions"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "waveId"
    type = "S"
  }

  global_secondary_index {
    name            = "waveId-index"
    hash_key        = "waveId"
    projection_type = "ALL"
  }

  tags = { Name = "${var.project_name}-sessions" }
}

# ============================================
# S3 Bucket for Music (Free Tier: 5GB)
# ============================================

resource "aws_s3_bucket" "music" {
  bucket = "wavy-music-${var.aws_account_id}"
  tags   = { Name = "wavy-music" }
}

resource "aws_s3_bucket_public_access_block" "music" {
  bucket = aws_s3_bucket.music.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "music_read" {
  bucket     = aws_s3_bucket.music.id
  depends_on = [aws_s3_bucket_public_access_block.music]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "PublicReadMusic"
      Effect    = "Allow"
      Principal = "*"
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.music.arn}/music/*"
    }]
  })
}

# ============================================
# ECR Repository (Free Tier: 500MB)
# ============================================

resource "aws_ecr_repository" "app" {
  name = var.project_name

  image_scanning_configuration {
    scan_on_push = false
  }

  tags = { Name = var.project_name }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only 2 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 2
      }
      action = { type = "expire" }
    }]
  })
}

# ============================================
# CloudWatch Logs (Free Tier: 5GB ingestion)
# ============================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/${var.project_name}"
  retention_in_days = 3
  tags              = { Name = var.project_name }
}

# ============================================
# Security Group for EC2
# ============================================

resource "aws_security_group" "ec2" {
  name_prefix = "${var.project_name}-ec2-"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Backend API + WebSocket"
  }

  ingress {
    from_port   = 1935
    to_port     = 1935
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "RTMP"
  }

  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HLS"
  }

  ingress {
    from_port   = 7880
    to_port     = 7880
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "LiveKit"
  }

  ingress {
    from_port   = 50000
    to_port     = 60000
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "WebRTC UDP"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "SSH"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-ec2-sg" }
}

# ============================================
# IAM Role for EC2
# ============================================

resource "aws_iam_role" "ec2" {
  name = "${var.project_name}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ec2_app" {
  name = "app-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.waves.arn,
          aws_dynamodb_table.users.arn,
          aws_dynamodb_table.tracks.arn,
          aws_dynamodb_table.cache.arn,
          aws_dynamodb_table.sessions.arn,
          "${aws_dynamodb_table.tracks.arn}/index/*",
          "${aws_dynamodb_table.sessions.arn}/index/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.music.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.music.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = [aws_ecr_repository.app.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["${aws_cloudwatch_log_group.app.arn}:*"]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2.name
}

# ============================================
# EC2 Instance (Free Tier: t2.micro 750hrs/mo)
# ============================================

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = "t2.micro"
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  vpc_security_group_ids = [aws_security_group.ec2.id]
  subnet_id              = data.aws_subnets.default.ids[0]

  associate_public_ip_address = true

  root_block_device {
    volume_size = 8
    volume_type = "gp3"
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e
    yum update -y
    yum install -y docker
    systemctl enable docker
    systemctl start docker
    usermod -aG docker ec2-user

    # Create startup script
    cat > /home/ec2-user/start-wavy.sh << 'SCRIPT'
    #!/bin/bash
    REGION="${var.aws_region}"
    ACCOUNT="${var.aws_account_id}"
    REPO="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/${var.project_name}"
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "localhost")

    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
    docker pull $REPO:latest
    docker stop wavy 2>/dev/null; docker rm wavy 2>/dev/null

    docker run -d --restart=always --name wavy \
      -p 3000:3000 -p 1935:1935 -p 8000:8000 -p 7880:7880 \
      -e NODE_ENV=production \
      -e PORT=3000 \
      -e AWS_REGION=$REGION \
      -e LIVEKIT_API_KEY=${var.livekit_api_key} \
      -e LIVEKIT_API_SECRET=${var.livekit_api_secret} \
      -e LIVEKIT_URL=ws://localhost:7880 \
      -e PUBLIC_HOST=$PUBLIC_IP \
      -e JWT_SECRET=${var.jwt_secret} \
      $REPO:latest
    SCRIPT
    chmod +x /home/ec2-user/start-wavy.sh

    # Create systemd service to run on boot
    cat > /etc/systemd/system/wavy.service << 'SVC'
    [Unit]
    Description=WAVY Backend
    After=docker.service
    Requires=docker.service

    [Service]
    Type=oneshot
    RemainAfterExit=yes
    ExecStart=/home/ec2-user/start-wavy.sh

    [Install]
    WantedBy=multi-user.target
    SVC
    systemctl enable wavy.service

    # Run now
    /home/ec2-user/start-wavy.sh
  EOF
  )

  tags = { Name = var.project_name }
}

# ============================================
# Lambda Start/Stop (Free Tier: 1M req/mo)
# ============================================

resource "aws_iam_role" "lambda" {
  name = "${var.project_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "lambda_ec2" {
  name = "ec2-startstop"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ec2:StartInstances", "ec2:StopInstances"]
        Resource = [aws_instance.app.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["*"]
      }
    ]
  })
}

data "archive_file" "lambda_stop" {
  type        = "zip"
  output_path = "${path.module}/lambda_stop.zip"

  source {
    content  = <<-PYEOF
      import boto3
      def lambda_handler(event, context):
          boto3.client('ec2').stop_instances(InstanceIds=['${aws_instance.app.id}'])
          return {'statusCode': 200, 'body': 'Stopped'}
    PYEOF
    filename = "lambda_function.py"
  }
}

data "archive_file" "lambda_start" {
  type        = "zip"
  output_path = "${path.module}/lambda_start.zip"

  source {
    content  = <<-PYEOF
      import boto3
      def lambda_handler(event, context):
          boto3.client('ec2').start_instances(InstanceIds=['${aws_instance.app.id}'])
          return {'statusCode': 200, 'body': 'Started'}
    PYEOF
    filename = "lambda_function.py"
  }
}

resource "aws_lambda_function" "stop_service" {
  filename         = data.archive_file.lambda_stop.output_path
  function_name    = "${var.project_name}-stop"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_stop.output_base64sha256
}

resource "aws_lambda_function" "start_service" {
  filename         = data.archive_file.lambda_start.output_path
  function_name    = "${var.project_name}-start"
  role             = aws_iam_role.lambda.arn
  handler          = "lambda_function.lambda_handler"
  runtime          = "python3.12"
  source_code_hash = data.archive_file.lambda_start.output_base64sha256
}

# ============================================
# EventBridge Rules (8 AM - 4 PM COT)
# ============================================

resource "aws_cloudwatch_event_rule" "start_service" {
  name                = "${var.project_name}-start"
  description         = "Start EC2 at 8 AM COT (13 UTC)"
  schedule_expression = "cron(0 13 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_rule" "stop_service" {
  name                = "${var.project_name}-stop"
  description         = "Stop EC2 at 4 PM COT (21 UTC)"
  schedule_expression = "cron(0 21 ? * MON-FRI *)"
}

resource "aws_cloudwatch_event_target" "start_service" {
  rule = aws_cloudwatch_event_rule.start_service.name
  arn  = aws_lambda_function.start_service.arn
}

resource "aws_cloudwatch_event_target" "stop_service" {
  rule = aws_cloudwatch_event_rule.stop_service.name
  arn  = aws_lambda_function.stop_service.arn
}

resource "aws_lambda_permission" "start_eventbridge" {
  statement_id  = "AllowEventBridgeStart"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.start_service.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.start_service.arn
}

resource "aws_lambda_permission" "stop_eventbridge" {
  statement_id  = "AllowEventBridgeStop"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.stop_service.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.stop_service.arn
}

# ============================================
# Outputs
# ============================================

output "ec2_public_ip" {
  description = "EC2 public IP"
  value       = aws_instance.app.public_ip
}

output "app_url" {
  description = "Backend URL"
  value       = "http://${aws_instance.app.public_ip}:3000"
}

output "websocket_url" {
  description = "WebSocket URL"
  value       = "ws://${aws_instance.app.public_ip}:3000"
}

output "ecr_repository_url" {
  description = "ECR repository URL"
  value       = aws_ecr_repository.app.repository_url
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "dynamodb_tables" {
  description = "DynamoDB table names"
  value = {
    waves    = aws_dynamodb_table.waves.name
    users    = aws_dynamodb_table.users.name
    tracks   = aws_dynamodb_table.tracks.name
    cache    = aws_dynamodb_table.cache.name
    sessions = aws_dynamodb_table.sessions.name
  }
}

output "s3_music_bucket" {
  description = "S3 music bucket name"
  value       = aws_s3_bucket.music.bucket
}

output "schedule" {
  description = "Service schedule"
  value       = "8 AM - 4 PM COT (Mon-Fri)"
}
