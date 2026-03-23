terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "aws_region" {
  description = "AWS region donde está desplegado WAVY"
  type        = string
  default     = "us-east-1"
}

provider "aws" {
  region = var.aws_region
}

locals {
  account_id            = "372714114281"
  alb_name              = "wavy-alb"
  ecs_cluster_name      = "wavy-cluster"
  ecs_service_name      = "wavy-service"
  ecs_task_family       = "wavy-backend"
  ecs_container_name    = "wavy-backend"
  ecr_repository_name   = "wavy-backend"
  target_group_name     = "wavy-tg"
  s3_music_bucket       = "wavy-music-372714114281"
  lambda_stop_name      = "wavy-stop-service"
  event_rule_start_name = "wavy-start-service"
  event_rule_stop_name  = "wavy-stop-service"
  alb_sg_name           = "wavy-alb-sg"
  ecs_sg_name           = "wavy-ecs-sg"

  dynamodb_tables = {
    waves    = "wavy-waves"
    users    = "wavy-users"
    tracks   = "wavy-tracks"
    cache    = "wavy-backend-cache"
    sessions = "wavy-backend-sessions"
  }
}

# ============================================================
# Recursos existentes (estado real en AWS)
# ============================================================

data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_s3_bucket" "music" {
  bucket = local.s3_music_bucket
}

data "aws_ecr_repository" "backend" {
  name = local.ecr_repository_name
}

data "aws_ecs_cluster" "main" {
  cluster_name = local.ecs_cluster_name
}

data "aws_ecs_service" "backend" {
  cluster_arn  = data.aws_ecs_cluster.main.arn
  service_name = local.ecs_service_name
}

data "aws_lb" "alb" {
  name = local.alb_name
}

data "aws_lb_target_group" "backend" {
  name = local.target_group_name
}

data "aws_security_group" "alb" {
  filter {
    name   = "group-name"
    values = [local.alb_sg_name]
  }

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_security_group" "ecs" {
  filter {
    name   = "group-name"
    values = [local.ecs_sg_name]
  }

  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_dynamodb_table" "waves" {
  name = local.dynamodb_tables.waves
}

data "aws_dynamodb_table" "users" {
  name = local.dynamodb_tables.users
}

data "aws_dynamodb_table" "tracks" {
  name = local.dynamodb_tables.tracks
}

data "aws_dynamodb_table" "cache" {
  name = local.dynamodb_tables.cache
}

data "aws_dynamodb_table" "sessions" {
  name = local.dynamodb_tables.sessions
}

data "aws_cloudwatch_log_group" "ecs" {
  name = "/ecs/wavy-backend"
}

data "aws_cloudwatch_log_group" "lambda_stop" {
  name = "/aws/lambda/wavy-stop-service"
}

data "aws_lambda_function" "stop_service" {
  function_name = local.lambda_stop_name
}

data "aws_cloudwatch_event_rule" "start_service" {
  name = local.event_rule_start_name
}

data "aws_cloudwatch_event_rule" "stop_service" {
  name = local.event_rule_stop_name
}

# ============================================================
# Outputs de infraestructura activa
# ============================================================

output "aws_account_id" {
  description = "Cuenta AWS activa"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "Región activa"
  value       = var.aws_region
}

output "alb" {
  description = "Application Load Balancer en producción"
  value = {
    name       = data.aws_lb.alb.name
    arn        = data.aws_lb.alb.arn
    dns_name   = data.aws_lb.alb.dns_name
    scheme     = data.aws_lb.alb.internal ? "internal" : "internet-facing"
    type       = data.aws_lb.alb.load_balancer_type
    security_group_id = data.aws_security_group.alb.id
  }
}

output "backend_urls" {
  description = "Endpoints de backend activos"
  value = {
    https_base = "https://${data.aws_lb.alb.dns_name}"
    http_base  = "http://${data.aws_lb.alb.dns_name}"
    websocket  = "wss://${data.aws_lb.alb.dns_name}"
  }
}

output "ecs" {
  description = "ECS Fargate activo"
  value = {
    cluster_arn  = data.aws_ecs_cluster.main.arn
    service_name = data.aws_ecs_service.backend.name
    task_family  = local.ecs_task_family
    desired_count = data.aws_ecs_service.backend.desired_count
    launch_type   = data.aws_ecs_service.backend.launch_type
  }
}

output "target_group" {
  description = "Target group del backend"
  value = {
    name             = data.aws_lb_target_group.backend.name
    arn              = data.aws_lb_target_group.backend.arn
    port             = data.aws_lb_target_group.backend.port
    protocol         = data.aws_lb_target_group.backend.protocol
    health_check_path = data.aws_lb_target_group.backend.health_check[0].path
  }
}

output "network" {
  description = "Red activa usada por WAVY"
  value = {
    vpc_id      = data.aws_vpc.default.id
    vpc_cidr    = data.aws_vpc.default.cidr_block
    subnet_ids  = data.aws_subnets.default.ids
    alb_sg_id   = data.aws_security_group.alb.id
    ecs_sg_id   = data.aws_security_group.ecs.id
  }
}

output "storage" {
  description = "Almacenamiento activo"
  value = {
    s3_bucket            = data.aws_s3_bucket.music.id
    ecr_repository       = data.aws_ecr_repository.backend.name
    ecr_repository_url   = data.aws_ecr_repository.backend.repository_url
    dynamodb_waves       = data.aws_dynamodb_table.waves.name
    dynamodb_users       = data.aws_dynamodb_table.users.name
    dynamodb_tracks      = data.aws_dynamodb_table.tracks.name
    dynamodb_cache       = data.aws_dynamodb_table.cache.name
    dynamodb_sessions    = data.aws_dynamodb_table.sessions.name
  }
}

output "observability" {
  description = "Logs y automatizaciones activas"
  value = {
    ecs_log_group         = data.aws_cloudwatch_log_group.ecs.name
    lambda_stop_log_group = data.aws_cloudwatch_log_group.lambda_stop.name
    lambda_stop_name      = data.aws_lambda_function.stop_service.function_name
    event_rule_start      = data.aws_cloudwatch_event_rule.start_service.name
    event_rule_stop       = data.aws_cloudwatch_event_rule.stop_service.name
  }
}
