#!/bin/bash

##############################################################################
# Oracle Cloud ARM Instance Creator (A1.Flex - FREE!)
# Creates a powerful ARM instance with 4 vCPUs + 24 GB RAM - all FREE!
##############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Oracle Cloud ARM Instance Creator${NC}"
echo -e "${BLUE}VM.Standard.A1.Flex (4 vCPU + 24 GB RAM)${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Configuration (from your existing setup)
COMPARTMENT_ID="ocid1.tenancy.oc1..aaaaaaaavky7g3z5qogo5tqekqt3xbvsvvxbfaoxqalst2mpdkes2egxznoa"
AVAILABILITY_DOMAIN="lZdH:AP-SINGAPORE-1-AD-1"
SUBNET_ID="ocid1.subnet.oc1.ap-singapore-1.aaaaaaaah5r73qnvx55utqk4t7hxlho5umr4zi6zqhvmmz24g23aa4jv2w4a"  # Current working subnet
IMAGE_ID="ocid1.image.oc1.ap-singapore-1.aaaaaaaagusldz4gofxodnpzf7puyf2sojnaedhrb33b5iroveq5jdqxx5oq"  # Ubuntu 24.04 ARM

# Read SSH public key from file
if [ -f ~/.ssh/oracle_vm.key.pub ]; then
    SSH_PUBLIC_KEY=$(cat ~/.ssh/oracle_vm.key.pub)
else
    echo -e "${RED}❌ SSH public key not found at ~/.ssh/oracle_vm.key.pub${NC}"
    echo "Generating from private key..."
    ssh-keygen -y -f ~/.ssh/oracle_vm.key > ~/.ssh/oracle_vm.key.pub
    SSH_PUBLIC_KEY=$(cat ~/.ssh/oracle_vm.key.pub)
fi

# Instance configuration
INSTANCE_NAME="pakrail-arm"
SHAPE="VM.Standard.A1.Flex"
OCPUS=4  # Maximum free: 4 OCPUs
MEMORY_GB=24  # Maximum free: 24 GB
BOOT_VOLUME_GB=100  # Free: up to 200 GB

echo -e "${YELLOW}⚙️  Configuration:${NC}"
echo "   Instance Name: $INSTANCE_NAME"
echo "   Shape: $SHAPE"
echo "   OCPUs: $OCPUS"
echo "   Memory: ${MEMORY_GB} GB"
echo "   Boot Volume: ${BOOT_VOLUME_GB} GB"
echo "   Availability Domain: $AVAILABILITY_DOMAIN"
echo ""

echo -e "${BLUE}🚀 Creating ARM instance...${NC}"
echo ""

# Create the instance
RESULT=$(oci compute instance launch \
  --availability-domain "$AVAILABILITY_DOMAIN" \
  --compartment-id "$COMPARTMENT_ID" \
  --shape "$SHAPE" \
  --shape-config '{"ocpus": '$OCPUS', "memoryInGBs": '$MEMORY_GB'}' \
  --display-name "$INSTANCE_NAME" \
  --image-id "$IMAGE_ID" \
  --subnet-id "$SUBNET_ID" \
  --assign-public-ip true \
  --boot-volume-size-in-gbs $BOOT_VOLUME_GB \
  --ssh-authorized-keys-file <(echo "$SSH_PUBLIC_KEY") \
  --wait-for-state RUNNING \
  2>&1)

if echo "$RESULT" | grep -q "OutOfHostCapacity\|InternalError\|Out of capacity\|Out of host capacity"; then
    echo -e "${RED}❌ No capacity available for ARM instances${NC}"
    echo ""
    echo -e "${YELLOW}📋 This is common for ARM instances. Options:${NC}"
    echo ""
    echo "1️⃣  Try a different Availability Domain"
    echo "2️⃣  Try with fewer resources (2 OCPUs + 12 GB RAM)"
    echo "3️⃣  Use the auto-retry script (will keep trying until capacity available)"
    echo "4️⃣  Stick with your current AMD instance (works great!)"
    echo ""
    exit 1
elif echo "$RESULT" | grep -q "TooManyRequests"; then
    echo -e "${RED}❌ Rate limited by Oracle${NC}"
    echo "Wait 30 minutes and try again"
    exit 1
elif echo "$RESULT" | grep -q '"id":'; then
    echo -e "${GREEN}✅ ARM Instance created successfully!${NC}"
    echo ""
    
    # Extract instance ID and IP
    INSTANCE_ID=$(echo "$RESULT" | grep -o '"id": *"[^"]*"' | head -1 | sed 's/"id": *"\([^"]*\)"/\1/')
    
    echo "   Instance ID: $INSTANCE_ID"
    echo ""
    echo -e "${BLUE}⏳ Waiting for instance to boot and get public IP...${NC}"
    sleep 10
    
    # Get public IP
    PUBLIC_IP=$(oci compute instance list-vnics --instance-id "$INSTANCE_ID" --query 'data[0]."public-ip"' --raw-output 2>/dev/null)
    
    if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "null" ]; then
        echo -e "${GREEN}✅ Public IP assigned: $PUBLIC_IP${NC}"
        echo ""
        echo -e "${YELLOW}📋 Next Steps:${NC}"
        echo ""
        echo "1️⃣  Wait 2-3 minutes for instance to fully boot"
        echo ""
        echo "2️⃣  Connect via SSH:"
        echo "   ssh -i ~/.ssh/oracle_vm.key ubuntu@$PUBLIC_IP"
        echo ""
        echo "3️⃣  Deploy your app (use the deployment script from ORACLE_SERVER_GUIDE.md)"
        echo ""
        echo "4️⃣  Update public/config.js with new IP:"
        echo "   primary: 'http://$PUBLIC_IP:3000'"
        echo ""
        echo -e "${GREEN}🎉 Your powerful ARM instance is ready!${NC}"
        echo "   • 4 vCPUs (vs 1 on AMD)"
        echo "   • 24 GB RAM (vs 1 GB on AMD)"
        echo "   • 100% FREE Forever!"
    else
        echo -e "${YELLOW}⚠️  Instance created but IP not ready yet${NC}"
        echo "Run this command to get the IP:"
        echo "   oci compute instance list-vnics --instance-id $INSTANCE_ID --query 'data[0].\"public-ip\"'"
    fi
else
    echo -e "${RED}❌ Failed to create instance${NC}"
    echo ""
    echo "Error details:"
    echo "$RESULT"
    exit 1
fi

