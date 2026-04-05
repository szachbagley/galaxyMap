# Galaxy Map API — Test Deployment on AWS

This document describes how to deploy the Galaxy Map API and its MySQL database to AWS as a single EC2 instance. No RDS — MySQL runs on the same server as the API.

---

## Deployed Instance Reference

This section records the live deployment created on 2026-04-04.

### AWS Resources

| Resource | Value |
|---|---|
| AWS Account ID | `403894226819` |
| Region | `us-east-1` |
| Instance ID | `i-09e6b9e94eef1fd27` |
| Instance type | `t2.micro` (Amazon Linux 2023) |
| AMI | `ami-0446b021dec428a7b` |
| Security Group | `sg-00ed86f7f971a0f12` (galaxy-map-sg) |
| Key pair name | `galaxy-map-key` |

> **Note:** The public IP is not static. It changes every time the instance is stopped and restarted. See the "Stopping the Instance" section for how to retrieve the current IP, or allocate an Elastic IP to fix it.

### SSH Access

```bash
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@<current-public-ip>
```

- **SSH key file:** `~/.ssh/galaxy-map-key.pem` (on your local machine)
- **OS user:** `ec2-user`
- **App directory on instance:** `~/galaxy-map-api`

Get the current public IP at any time:

```bash
aws ec2 describe-instances \
  --instance-ids i-09e6b9e94eef1fd27 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

### API

| Item | Value |
|---|---|
| Current public IP | `107.22.141.149` (changes on stop/start) |
| Port | `3001` |
| Base URL | `http://107.22.141.149:3001/api` |
| PM2 process name | `galaxy-map-api` |

### Database (MySQL 8.4, localhost only)

| Item | Value |
|---|---|
| Host | `localhost` (not exposed externally) |
| Port | `3306` |
| Database name | `galaxy_map` |
| App user | `galaxyapp` |
| App password | `G@l4xyApp!2026` |
| Root password | `RootPass123!Galaxy` |

Connect from inside the instance:

```bash
# As the app user
mysql -u galaxyapp -p'G@l4xyApp!2026' galaxy_map

# As root
mysql -u root -p'RootPass123!Galaxy'
```

### Quick-start commands (run on the instance after SSH)

```bash
pm2 status                        # check if API is running
pm2 logs galaxy-map-api           # live log stream
pm2 restart galaxy-map-api        # restart after a code change
sudo systemctl status mysqld      # check MySQL status
```

---

**Cost:** Free for 12 months under the AWS free tier (750 hours/month of t2.micro). After free tier: ~$8–10/month.

**Architecture:**

```
Internet → EC2 t2.micro (Amazon Linux 2023)
               ├── Node.js API (port 3001, managed by PM2)
               └── MySQL 8.0 (localhost only)
```

Everything — the API process, MySQL, and the seeded data — lives on one instance. No load balancer, no RDS, no VPC complexity.

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`) with credentials for your new account
- Your AWS account has free tier eligibility
- `ssh-keygen` available locally (standard on macOS)

---

## Step 1 — Create an EC2 Key Pair

This is the SSH key you'll use to log into the instance.

```bash
aws ec2 create-key-pair \
  --key-name galaxy-map-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/galaxy-map-key.pem

chmod 400 ~/.ssh/galaxy-map-key.pem
```

---

## Step 2 — Create a Security Group

Open port 22 (SSH) and port 3001 (the API) to the public internet.

```bash
# Create the group
SG_ID=$(aws ec2 create-security-group \
  --group-name galaxy-map-sg \
  --description "Galaxy Map API" \
  --query 'GroupId' \
  --output text)

echo "Security Group ID: $SG_ID"

# Allow SSH from anywhere (tighten this to your IP in production)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# Allow API traffic on port 3001
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp --port 3001 --cidr 0.0.0.0/0
```

---

## Step 3 — Launch a t2.micro Instance

Amazon Linux 2023 is the target OS. Look up the latest AMI ID for your region first:

```bash
# Get the latest Amazon Linux 2023 AMI ID for us-east-1
# (change --region if you're using a different region)
AMI_ID=$(aws ec2 describe-images \
  --owners amazon \
  --filters \
    "Name=name,Values=al2023-ami-2023*" \
    "Name=architecture,Values=x86_64" \
    "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

echo "AMI: $AMI_ID"

# Launch the instance
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type t2.micro \
  --key-name galaxy-map-key \
  --security-group-ids $SG_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=galaxy-map-api}]' \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "Instance ID: $INSTANCE_ID"
```

Wait for it to reach the running state (about 60 seconds):

```bash
aws ec2 wait instance-running --instance-ids $INSTANCE_ID
echo "Instance is running"
```

Get the public IP:

```bash
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $PUBLIC_IP"
```

---

## Step 4 — SSH into the Instance

```bash
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@$PUBLIC_IP
```

All remaining steps in this section are run **inside the SSH session** unless noted otherwise.

---

## Step 5 — Install Node.js and MySQL on the Instance

```bash
# Update system packages
sudo dnf update -y

# Install Node.js 18 via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Verify
node -v   # should print v18.x.x
npm -v

# Install MySQL 8.0
sudo dnf install -y mysql-server

# Start MySQL and enable it on boot
sudo systemctl start mysqld
sudo systemctl enable mysqld

# Secure the installation and set a root password
sudo mysql_secure_installation
# When prompted:
#   - Set root password: yes → choose a strong password, note it down
#   - Remove anonymous users: yes
#   - Disallow root login remotely: yes
#   - Remove test database: yes
#   - Reload privilege tables: yes

# Install PM2 globally (Node.js process manager)
sudo npm install -g pm2
```

---

## Step 6 — Create the Database and a Dedicated User

```bash
# Log into MySQL as root (enter the password you set above)
sudo mysql -u root -p
```

Inside the MySQL shell:

```sql
CREATE DATABASE galaxy_map;

CREATE USER 'galaxyapp'@'localhost' IDENTIFIED BY 'choose-a-strong-password';
GRANT ALL PRIVILEGES ON galaxy_map.* TO 'galaxyapp'@'localhost';
FLUSH PRIVILEGES;

EXIT;
```

---

## Step 7 — Upload the Code

Run these commands **on your local machine** (open a second terminal, leaving the SSH session open).

The `data/` directory is excluded from `.gitignore` but is needed for seeding. Include it in the upload.

```bash
# From your local machine, in the galaxyMap/ directory
PUBLIC_IP=<paste your instance IP here>

# Create the app directory on the instance
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@$PUBLIC_IP "mkdir -p ~/galaxy-map-api"

# Upload the backend code (excludes node_modules and .env)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  /Users/zachbagley/galaxyMap/backend/ \
  ec2-user@$PUBLIC_IP:~/galaxy-map-api/
```

---

## Step 8 — Configure the Environment

Back in the SSH session on the instance:

```bash
cd ~/galaxy-map-api

# Create the .env file with production values
cat > .env << 'EOF'
DB_HOST=localhost
DB_PORT=3306
DB_USER=galaxyapp
DB_PASSWORD=choose-a-strong-password
DB_NAME=galaxy_map
PORT=3001
EOF

chmod 600 .env   # restrict read access
```

---

## Step 9 — Install Dependencies, Migrate, and Seed

```bash
cd ~/galaxy-map-api

# Install production dependencies only
npm install --omit=dev

# Run the migration (creates the systems table)
npx knex migrate:latest --knexfile src/db/knexfile.js

# Seed the database (~6,700 canon systems)
npx knex seed:run --knexfile src/db/knexfile.js
```

Verify the data landed:

```bash
mysql -u galaxyapp -p galaxy_map -e "SELECT COUNT(*) FROM systems;"
# Should print 6757
```

---

## Step 10 — Start the API with PM2

PM2 keeps the process running after you disconnect and restarts it automatically if it crashes.

```bash
cd ~/galaxy-map-api

pm2 start src/index.js --name galaxy-map-api

# Verify it's running
pm2 status

# Persist PM2 across reboots
pm2 save
pm2 startup   # follow the printed instruction (it gives you a sudo command to run)
```

---

## Step 11 — Smoke Test

From your local machine:

```bash
PUBLIC_IP=<your instance IP>

# Health check — list of systems in grid square J-8
curl http://$PUBLIC_IP:3001/api/systems/grid/J/8

# Single system
curl http://$PUBLIC_IP:3001/api/systems/1161

# Nearby systems
curl http://$PUBLIC_IP:3001/api/systems/1161/nearby
```

The API is publicly reachable at `http://<PUBLIC_IP>:3001`.

---

## Redeploying Updated Code

When you make local changes and need to push them to the instance:

```bash
# 1. Upload changes (from local machine)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.env' \
  /Users/zachbagley/galaxyMap/backend/ \
  ec2-user@$PUBLIC_IP:~/galaxy-map-api/

# 2. On the instance — reinstall deps if package.json changed, then restart
ssh -i ~/.ssh/galaxy-map-key.pem ec2-user@$PUBLIC_IP \
  "cd ~/galaxy-map-api && npm install --omit=dev && pm2 restart galaxy-map-api"
```

---

## Useful PM2 Commands (run on the instance)

```bash
pm2 status                      # check process state
pm2 logs galaxy-map-api         # stream live logs
pm2 logs galaxy-map-api --lines 100   # last 100 log lines
pm2 restart galaxy-map-api      # restart after a code change
pm2 stop galaxy-map-api         # stop the process
```

---

## Stopping the Instance (to avoid charges)

If you need to pause the deployment, stop (don't terminate) the instance. A stopped instance incurs no compute charges, though the attached EBS volume (~$0.10/GB/month) still costs a small amount.

```bash
aws ec2 stop-instances --instance-ids $INSTANCE_ID
```

To restart it later:

```bash
aws ec2 start-instances --instance-ids $INSTANCE_ID

# The public IP will change on restart — get the new one
aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

To assign a fixed IP that survives restarts, allocate an Elastic IP (free while the instance is running, ~$0.005/hour if the instance is stopped):

```bash
ALLOC_ID=$(aws ec2 allocate-address --query 'AllocationId' --output text)
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $ALLOC_ID
```

---

## Cost Estimate

| Resource | Free Tier | After Free Tier |
|---|---|---|
| EC2 t2.micro (750 hrs/month) | Free for 12 months | ~$8.50/month |
| EBS gp2 storage (30 GB/month) | Free for 12 months | ~$2.40/month |
| Data transfer (first 100 GB/month out) | Free | $0.09/GB |
| MySQL (on-instance) | Free | Free |
| **Total** | **$0** | **~$11/month** |
