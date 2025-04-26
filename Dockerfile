FROM ubuntu:22.04

# Install common dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    unzip \
    ca-certificates \
    qemu-kvm qemu-system-x86 \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip3 install uv --break-system-packages

# Check for Linux and install KVM only if on Linux
RUN if [ "$(uname -s)" = "Linux" ]; then \
    apt-get update && \
    apt-get install -y qemu-kvm qemu-system-x86 --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*; \
    fi

# Download and install Firecracker only if we're on Linux
RUN if [ "$(uname -s)" = "Linux" ]; then \
    wget https://github.com/firecracker-microvm/firecracker/releases/download/v1.3.0/firecracker-v1.3.0-x86_64.tgz && \
    tar -xvf firecracker-v1.3.0-x86_64.tgz && \
    mv release-v1.3.0-x86_64/firecracker-v1.3.0-x86_64 /usr/local/bin/firecracker && \
    mv release-v1.3.0-x86_64/jailer-v1.3.0-x86_64 /usr/local/bin/jailer && \
    rm -rf firecracker-v1.3.0-x86_64.tgz release-v1.3.0-x86_64 && \
    chmod +x /usr/local/bin/firecracker /usr/local/bin/jailer; \
    fi

# Install pnpm
RUN npm install -g pnpm@8.15.4

# Set up the application
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package.json ./
COPY pnpm-lock.yaml ./

# Remove lockfile and install root dependencies
RUN rm -f pnpm-lock.yaml && pnpm install --no-frozen-lockfile --no-strict-peer-dependencies

# Copy application code
COPY . .

# Extract rootfs
RUN tar -xzf /app/assets/rootfs.ext4.tar.gz -C /app/assets/ && \
    rm /app/assets/rootfs.ext4.tar.gz

# Install frontend dependencies
WORKDIR /app/frontend
RUN rm -f pnpm-lock.yaml && pnpm install --no-frozen-lockfile --no-strict-peer-dependencies
WORKDIR /app

# Build the application
RUN pnpm build

# Expose the application port
EXPOSE 3000

# Create and set up entrypoint script
RUN echo '#!/bin/bash\nset -e\n\n# Check if we are on Linux with KVM support\nif [ "$(uname -s)" = "Linux" ] && [ -c /dev/kvm ]; then\n  echo "KVM is available, Firecracker can be used"\n  export USE_FIRECRACKER=true\nelse\n  echo "KVM is not available, running in compatibility mode without Firecracker"\n  export USE_FIRECRACKER=false\nfi\n\n# Execute the CMD\nexec "$@"' > /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]

# Start the built application
CMD ["pnpm", "start"]