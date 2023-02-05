#!/bin/bash
sso() {
	if [ $# -eq 0 ]
	  then
	    echo "No arguments supplied"
	fi
	profile=$1
	aws sso login --profile $profile
	export AWS_PROFILE=$profile
	export NODE_ENV=$profile
}

eks() {
	if [ $# -eq 0 ]
          then
            echo "No arguments supplied"
        fi
	profile=$1
	export AWS_PROFILE=$profile
	aws eks update-kubeconfig --region us-west-2 --name k8s-cluster
}

mk() {

	kubectl config use-context minikube
}
